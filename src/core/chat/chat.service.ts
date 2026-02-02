import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	Sse,
	UploadedFiles,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import { ChatCompletion } from 'openai/resources';
import * as fs from 'fs';
import { DatabaseService } from 'src/database/database.service';
import { documents } from 'src/database/schema/documents';
import { ChromaConfigType, OpenAIConfigType } from 'src/config/config.types';
import { and, desc, eq, exists, sql } from 'drizzle-orm';
import { chatMessages, chats, chatSummaries, users } from 'src/database/schema';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { CloudClient } from 'chromadb';
import { S3Service } from 'src/common/services/s3/s3.service';
import { ContextGeneratorService } from './helpers/contextGenerator';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { CacheService } from 'src/common/services/cache/cache.service';

/**
 * Custom OpenAI Embedding Function for ChromaDB
 */
class OpenAIEmbeddingFunction {
	private openai: OpenAI;

	constructor(openaiApiKey: string) {
		this.openai = new OpenAI({ apiKey: openaiApiKey });
	}

	async generate(texts: string[]): Promise<number[][]> {
		const response = await this.openai.embeddings.create({
			model: 'text-embedding-3-small',
			input: texts,
			dimensions: 1536, // Max = 1536
		});
		return response.data.map((item) => item.embedding);
	}
}

@Injectable()
export class ChatService {
	private openai: OpenAI;
	private chromaClient: CloudClient;
	private embeddingFunction: OpenAIEmbeddingFunction;
	private collectionName = 'documents';
	private readonly DEFAULT_CHAT_NAME = 'New Chat';
	private readonly CHAT_TITLE_MAX_LENGTH = 28; // Fits in 220px - frontend specifications
	private readonly MODEL = 'gpt-5-mini';
	private collectionCache: any = null; // Cache the collection reference

	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
		private s3Service: S3Service,
		private contextGenerator: ContextGeneratorService,
		private cacheService: CacheService
	) {
		const openaiKey =
			this.configService.get<OpenAIConfigType>('openai')!.key!;

		this.openai = new OpenAI({
			apiKey: openaiKey,
		});

		this.embeddingFunction = new OpenAIEmbeddingFunction(openaiKey);

		this.chromaClient = new CloudClient({
			apiKey: this.configService.get<ChromaConfigType>('chroma')!.apiKey!,
			tenant: this.configService.get<ChromaConfigType>('chroma')!.tenant,
			database:
				this.configService.get<ChromaConfigType>('chroma')!.database,
		});

		// Initialize collection cache
		this.initializeCollection();
	}

	/**
	 * Initialize and cache the collection reference
	 */
	private async initializeCollection() {
		try {
			this.collectionCache =
				await this.chromaClient.getOrCreateCollection({
					name: this.collectionName,
					metadata: { 'hnsw:space': 'cosine' },
					embeddingFunction: this.embeddingFunction,
				});
		} catch (error) {
			console.error('Error initializing collection cache:', error);
		}
	}

	/**
	 * Helper: Generate embeddings using OpenAI API directly
	 */
	private async generateEmbeddings(texts: string[]): Promise<number[][]> {
		const response = await this.openai.embeddings.create({
			model: 'text-embedding-3-small',
			input: texts,
			dimensions: 1536, // max = 1536
		});
		return response.data.map((item) => item.embedding);
	}

	/**
	 * Helper: Get or create collection (use cache if available)
	 */
	private async getOrCreateCollection() {
		if (this.collectionCache) {
			return this.collectionCache;
		}

		try {
			this.collectionCache =
				await this.chromaClient.getOrCreateCollection({
					name: this.collectionName,
					metadata: { 'hnsw:space': 'cosine' },
					embeddingFunction: this.embeddingFunction,
				});
			return this.collectionCache;
		} catch (error) {
			console.error('Error getting/creating collection:', error);
			throw new InternalServerErrorException(
				'Failed to access vector store'
			);
		}
	}

	/**
	 * Upload and process PDF documents using ChromaDB directly
	 * Flow: PDF → extract text per page → chunk → embed → store in Chroma
	 */
	async uploadDocumentNonApi(
		files: Array<Express.Multer.File>,
		chatId: string | 'new',
		userId: string,
		message?: string
	) {
		// Validate file upload
		if (!files || files.length === 0) {
			throw new BadRequestException('No files uploaded');
		}

		// Only PDF files are supported
		const pdfFiles = files.filter(
			(file) => file.mimetype === 'application/pdf'
		);
		if (pdfFiles.length === 0) {
			throw new BadRequestException('Only PDF files are supported');
		}

		if (chatId) {
			const chat = await this.databaseService.db.query.chats.findFirst({
				where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
			});

			if (!chat) {
				throw new BadRequestException('Chat not found');
			}
		}

		const results: {
			success: { id: string; name: string }[];
			failed: { name: string; reason?: string }[];
		} = {
			success: [],
			failed: [],
		};

		const MAX_UPLOADS = 5;

		// Check existing documents to enforce upload limit
		let remainingSlots = MAX_UPLOADS;

		const existingDocuments = await this.databaseService.db
			.select()
			.from(documents)
			.where(
				and(
					eq(documents.chatId, chatId),
					eq(documents.userId, userId)
				)
			);

		remainingSlots = MAX_UPLOADS - existingDocuments.length;
		remainingSlots = Math.max(remainingSlots, 0);

		if (remainingSlots <= 0) {
			return {
				message: `You have used up the available upload slots (${MAX_UPLOADS}).`,
				successfulUploads: [],
				failedUploads: pdfFiles.map((file) => ({
					name: file.originalname,
				})),
			};
		}

		// Get or create chroma db collection
		const collection = await this.getOrCreateCollection();

		for (const file of pdfFiles) {
			if (remainingSlots <= 0) {
				results.failed.push({
					name: file.originalname,
					reason: 'No remaining upload slots',
				});
				continue;
			}

			try {
				// Step 1: Read file buffer once (used for both PDF parsing and S3 upload)
				const fileBuffer = fs.readFileSync(file.path);

				// Extract text from PDF using pdfjs-serverless (serverless-compatible, same API as pdfjs-dist)
				const uint8Array = new Uint8Array(fileBuffer);

				// Dynamic import pdfjs-serverless (types don't resolve with nodenext, but runtime works)
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const pdfjs = await import('pdfjs-serverless') as any;
				const getDocument = pdfjs.getDocument as (options: { data: Uint8Array; useSystemFonts?: boolean }) => { promise: Promise<any> };

				// Get PDF document using pdfjs-serverless
				const pdf = await getDocument({ 
					data: uint8Array,
					useSystemFonts: true,
				}).promise;

				// Accumulate page texts with metadata
				interface PageData {
					text: string;
					page: number;
				}

				const pageData: PageData[] = [];

				// Extract text per page (concatenate all words for a page)
				for (let i = 1; i <= pdf.numPages; i++) {
					const page = await pdf.getPage(i);
					const textContent = await page.getTextContent();
					const pageText = textContent.items
						.filter((item: any) => 'str' in item)
						.map((item: any) => item.str)
						.join(' ');
					pageData.push({ text: pageText, page: i });
				}

				// Step 2: Chunk text using RecursiveCharacterTextSplitter
				const textSplitter = new RecursiveCharacterTextSplitter({
					chunkSize: 1000,
					chunkOverlap: 200,
				});

				// Split each page's text
				const allChunks: Array<{
					text: string;
					page: number;
				}> = [];

				for (const pageInfo of pageData) {
					const chunks = await textSplitter.splitText(pageInfo.text);
					chunks.forEach((chunk) => {
						allChunks.push({
							text: chunk,
							page: pageInfo.page,
						});
					});
				}

				// Step 3: Generate S3 key and save document metadata to database first
				const s3Key = this.s3Service.generateKey(
					userId,
					file.originalname
				);

				const [documentRecord] = await this.databaseService.db
					.insert(documents)
					.values({
						chatId,
						userId,
						fileName: file.originalname,
						fileType: file.mimetype,
						fileSize: file.size,
						vectorStoreId: `chat_${chatId}`,
						vectorStoreFileId: `${chatId}_${Date.now()}`,
						s3key: s3Key,
					})
					.returning();

				// Upload file to S3 in a non-blocking way (fire and forget with error handling)
				this.s3Service
					.uploadObject('user-docs', s3Key, fileBuffer, file.mimetype)
					.catch((err) => {
						console.error(
							`Failed to upload ${
								file.originalname
							} to S3 from user ${userId} at ${new Date().toISOString()}:`,
							err
						);
						// Optionally: Add logic to mark document as failed upload in database
					});

				// Step 4: Generate embeddings for all chunks
				const chunkTexts = allChunks.map((c) => c.text);
				const embeddings = await this.generateEmbeddings(chunkTexts);

				// Step 5: Prepare data for ChromaDB
				const ids: string[] = [];
				const metadatas: Array<Record<string, any>> = [];
				const chromaDocs: string[] = [];

				allChunks.forEach((chunk, index) => {
					ids.push(`${documentRecord.id}_chunk_${index}`);
					metadatas.push({
						documentId: String(documentRecord.id),
						fileName: file.originalname,
						chatId: String(chatId),
						userId: String(userId),
						page: chunk.page,
						source: file.originalname,
					});
					chromaDocs.push(chunk.text);
				});

				// Step 5: Add to ChromaDB collection in batches (max 300 per operation for Cloud)
				const CHROMA_BATCH_SIZE = 300;
				for (let i = 0; i < ids.length; i += CHROMA_BATCH_SIZE) {
					const batchIds = ids.slice(i, i + CHROMA_BATCH_SIZE);
					const batchEmbeddings = embeddings.slice(i, i + CHROMA_BATCH_SIZE);
					const batchMetadatas = metadatas.slice(i, i + CHROMA_BATCH_SIZE);
					const batchDocuments = chromaDocs.slice(i, i + CHROMA_BATCH_SIZE);

					await collection.add({
						ids: batchIds,
						embeddings: batchEmbeddings,
						metadatas: batchMetadatas,
						documents: batchDocuments,
					});
				}

				results.success.push({
					id: documentRecord.id,
					name: documentRecord.fileName,
				});
				remainingSlots--;

				// Clean up uploaded file from disk
				fs.unlinkSync(file.path);
			} catch (err) {
				console.error('Error processing PDF:', err);
				results.failed.push({
					name: file.originalname,
					reason:
						err instanceof Error ? err.message : 'Unknown error',
				});
			}
		}

		return {
			message:
				results.failed.length > 0
					? `Some files failed to upload`
					: 'All files uploaded successfully',
			remainingSlots,
			chatId,
			successfulUploads: results.success,
			failedUploads: results.failed,
		};
	}

	/**
	 * Send message with RAG using ChromaDB directly
	 * Flow: Query → Retrieve similar chunks → LLM response with context
	 */
	async sendBufferedMessage(
		chatId: string | 'new',
		message: string,
		userId: string,
		selectedDocumentIds?: string[],
		pageNumber?: number,
		pageContent?: string
	) {
		// Verify chat exists and belongs to user
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
			with: { documents: true },
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		if (chat.title === this.DEFAULT_CHAT_NAME) {
			// Update chat title based on first message
			await this.databaseService.db
				.update(chats)
				.set({ title: message.slice(0, this.CHAT_TITLE_MAX_LENGTH) })
				.where(eq(chats.id, chatId));
		}

		const [count, messages, user] = await Promise.all([
			this.databaseService.db.$count(
				chatMessages,
				eq(chatMessages.chatId, chatId)
			),
			this.databaseService.db
				.select()
				.from(chatMessages)
				.where(eq(chatMessages.chatId, chatId))
				.orderBy(chatMessages.createdAt),
			this.databaseService.db.query.users.findFirst({
				where: eq(users.id, userId),
			}),
		]);

		const recentHistory =
			this.contextGenerator.formatRecentHistory(messages);

		const olderSummaryText = await this.contextGenerator.getLatestSummary(
			chatId
		);

		// Generate summary asynchronously (non-blocking) if needed
		if (count % 6 === 1 && messages.length > 4) {
			this.contextGenerator
				.generateSummary(
					this.openai,
					chatId,
					count,
					messages,
					this.MODEL
				)
				.catch((err) => {
					console.error(
						`Failed to generate summary for chat ${chatId}:`,
						err
					);
				});
		}

		try {
			let context = '';
			let retrievedMetadatas: any[] = [];
			let retrievedDocs: any[] = [];

			const shouldRetrieve =
				chat.documents &&
				chat.documents.length > 0 &&
				selectedDocumentIds &&
				selectedDocumentIds.length > 0;

			if (shouldRetrieve) {
				const collection = await this.getOrCreateCollection();
				const result =
					await this.contextGenerator.retrieveDocumentContext(
						collection,
						this.generateEmbeddings.bind(this),
						message,
						chatId,
						userId,
						selectedDocumentIds,
						this.openai,
						messages
					);
				context = result.context;
				retrievedMetadatas = result.retrievedMetadatas;
				retrievedDocs = result.retrievedDocs;
			}

			const prompt = this.contextGenerator.buildPrompt(
				user?.educationLevel,
				recentHistory,
				olderSummaryText,
				context,
				message,
				pageNumber,
				pageContent
			);

			const completion = await this.openai.chat.completions.create({
				model: this.MODEL,
				messages: [
					{
						role: 'system',
						content: `

You are a document-grounded assistant that helps users understand and reason about their uploaded documents.

When a document is provided, you must ground your responses strictly in the document’s content.
Use the document as the primary and authoritative source.

examples: "based on your document...", "you can also find this on <page number>", "this page covers...is that what you are looking for?" etc. only state document name if multiple documents are provided.

If page numbers or document names are not available, do not fabricate them and simply answer without citation.
If a user’s question cannot be answered from the document, clearly state that the information is not present in the provided material.
Do not introduce information not supported by the document unless explicitly requested.

you cannot search the web, you cannot provide images only ascii art, you are not an assistant primarily for coding etc. this info is just for you and not the user.


also if recent chat history or older chat summary is available, treat that as your memory, not something provided to you.

- be concise unless the user tells you otherwise. and do not state you are being concise.

- always wrap ascii art in triple backticks. and only suggest or output ascii art when relevant and not frequently.

- use "---" to show sections when necessary.

- use markdown for tables when necessary.

- Never use em dashes, use normal punctuations instead.

- since you can go through documents, you can suggest the user to upload a pdf document if they have one, to help you help them better. DO NOT DO THIS FREQUENTLY

- Make sure to take recent chat history and older chat summary into account when responding, if available, it is IMPORTANT.

- If you want the user to look at something in the document provided, always refer to the page number or section if available.
						`,
					},
					{
						role: 'user',
						content: prompt,
					},
				],
				temperature: 1,
			});

			const assistantMessage =
				completion.choices[0]?.message?.content ||
				'No response generated';

			// Step 8: Save message to database
			const [savedMessage] = await this.databaseService.db
				.insert(chatMessages)
				.values({
					chatId,
					turn: {
						user: message,
						assistant: assistantMessage,
					},
					totalTokens: completion.usage?.total_tokens || 0,
				})
				.returning();

			return {
				message: 'Message sent successfully',
				data: {
					message: savedMessage,
					sourceDocuments: retrievedMetadatas.map(
						(metadata, idx) => ({
							page: metadata?.page,
							source: metadata?.source || metadata?.fileName,
							content: retrievedDocs[idx]?.slice(0, 200) + '...',
						})
					),
				},
			};
		} catch (err) {
			console.error('Error sending message:', err);
			throw new InternalServerErrorException(
				err instanceof Error ? err.message : 'Error processing message'
			);
		}
	}

	async createStreamSession(
		chatId: string | 'new',
		message: string,
		userId: string,
		authToken: string,
		selectedDocumentIds?: string[],
		pageNumber?: number,
		pageContent?: string
	) {
		try {
			const streamSessionId =
				await this.cacheService.storeStreamSessionData(
					chatId,
					message,
					userId,
					authToken,
					selectedDocumentIds,
					pageNumber,
					pageContent
				);

			return {
				message: 'Stream session created',
				data: { streamSessionId },
			};
		} catch (error) {
			throw new InternalServerErrorException(
				'Failed to create stream session'
			);
		}
	}

	/**
	 * Send message with streaming response
	 */
	streamMessage(chatId: string): Observable<MessageEvent> {
		return new Observable<MessageEvent>((observer) => {
			const controller = new AbortController();

			(async () => {
				try {
					const session =
						await this.cacheService.getStreamSessionData(chatId);

					if (!session) {
						throw new BadRequestException(
							'Stream session not found'
						);
					}

					const {
						message,
						selectedDocumentIds,
						pageNumber,
						pageContent,
						userId,
					} = session;

					// Verify chat exists and belongs to user
					const chat =
						await this.databaseService.db.query.chats.findFirst({
							where: and(
								eq(chats.id, chatId),
								eq(chats.userId, userId)
							),
							with: { documents: true },
						});

					if (!chat) {
						observer.error(
							new BadRequestException('Chat not found')
						);
						return;
					}

					// Update chat title asynchronously (non-blocking)
					if (chat.title === this.DEFAULT_CHAT_NAME) {
						this.databaseService.db
							.update(chats)
							.set({
								title: message.slice(
									0,
									this.CHAT_TITLE_MAX_LENGTH
								),
							})
							.where(eq(chats.id, chatId))
							.catch((err) => {
								console.error(
									'Error updating chat title:',
									err
								);
							});
					}

					// Get count first to determine if we need all messages for summary generation
					const count = await this.databaseService.db.$count(
						chatMessages,
						eq(chatMessages.chatId, chatId)
					);

					const needsSummaryGeneration = count % 6 === 1 && count > 4;

					// Fetch all messages if summary generation is needed, otherwise just last 4
					const [messages, user] = await Promise.all([
						needsSummaryGeneration
							? await this.databaseService.db
									.select()
									.from(chatMessages)
									.where(eq(chatMessages.chatId, chatId))
									.orderBy(chatMessages.createdAt)
							: await this.databaseService.db
									.select()
									.from(chatMessages)
									.where(eq(chatMessages.chatId, chatId))
									.orderBy(desc(chatMessages.createdAt))
									.limit(4)
									.then((msgs) => msgs.reverse()),
						await this.databaseService.db.query.users.findFirst({
							where: eq(users.id, userId),
						}),
					]);

					const recentHistory =
						this.contextGenerator.formatRecentHistory(messages);

					// Generate summary asynchronously (non-blocking)
					if (needsSummaryGeneration) {
						this.contextGenerator
							.generateSummary(
								this.openai,
								chatId,
								count,
								messages,
								this.MODEL
							)
							.catch((err) => {
								console.error(
									`Failed to generate summary for chat ${chatId}:`,
									err
								);
							});
					}

					const shouldRetrieve =
						chat.documents &&
						chat.documents.length > 0 &&
						selectedDocumentIds &&
						selectedDocumentIds.length > 0;

					// Parallelize summary fetching and document retrieval
					const [olderSummaryText, retrievalResult] =
						await Promise.all([
							// Fetch summary only if there are enough messages
							count > 4
								? this.contextGenerator.getLatestSummary(chatId)
								: Promise.resolve(''),
							// Retrieve documents if needed
							shouldRetrieve
								? (async () => {
										const collection =
											await this.getOrCreateCollection();
										return this.contextGenerator.retrieveDocumentContext(
											collection,
											this.generateEmbeddings.bind(this),
											message,
											chatId,
											userId,
											selectedDocumentIds,
											this.openai,
											messages
										);
								  })()
								: Promise.resolve({
										context: '',
										retrievedMetadatas: [],
										retrievedDocs: [],
								  }),
						]);

					const context = retrievalResult.context;
					const retrievedMetadatas =
						retrievalResult.retrievedMetadatas;
					const retrievedDocs = retrievalResult.retrievedDocs;

					const prompt = this.contextGenerator.buildPrompt(
						user?.educationLevel,
						recentHistory,
						olderSummaryText,
						context,
						message,
						pageNumber,
						pageContent
					);

					// Start streaming
					let fullText = '';
					const completionStream = await this.openai.responses.create(
						{
							model: this.MODEL,
							input: [
								{
									role: 'system',
									content: `

You are a document-grounded assistant that helps users understand and reason about their uploaded documents.

When a document is provided, you must ground your responses strictly in the document's content.
Use the document as the primary and authoritative source.

examples: "based on your document...", "you can also find this on <page number>", "this page covers...is that what you are looking for?" etc. only state document name if multiple documents are provided.

If page numbers or document names are not available, do not fabricate them and simply answer without citation.
If a user's question cannot be answered from the document, clearly state that the information is not present in the provided material.
Do not introduce information not supported by the document unless explicitly requested.

you cannot search the web, you cannot provide images only ascii art, you are not an assistant primarily for coding etc. this info is just for you and not the user.


also if recent chat history or older chat summary is available, treat that as your memory, not something provided to you.

- be concise unless the user tells you otherwise. and do not state you are being concise.

- always wrap ascii art in triple backticks. and only suggest or output ascii art when relevant and not frequently.

- use "---" to show sections when necessary.

- use markdown for tables when necessary.

- Never use em dashes, use normal punctuations instead.

- since you can go through documents, you can suggest the user to upload a pdf document if they have one, to help you help them better. DO NOT DO THIS FREQUENTLY

- Make sure to take recent chat history and older chat summary into account when responding, if available, it is IMPORTANT.

- If you want the user to look at something in the document provided, always refer to the page number or section if available.
									`,
								},
								{
									role: 'user',
									content: prompt,
								},
							],
							temperature: 1,
							stream: true,
						},
						{ signal: controller.signal }
					);

					// Stream the response chunks
					for await (const event of completionStream) {
						if (event.type === 'response.output_text.delta') {
							fullText += event.delta;
							observer.next({ data: event.delta });
						}
					}

					// Save message to database in background after streaming completes
					this.databaseService.db
						.insert(chatMessages)
						.values({
							chatId,
							turn: {
								user: message,
								assistant: fullText,
							},
							totalTokens: 0, // Streaming doesn't provide token counts easily
							helpful: null,
						})
						.catch((err) => {
							console.error(
								'Error saving message to database:',
								err
							);
						});

					// initiate completion
					await this.cacheService.deleteStreamSessionData(chatId);
					observer.next({
						data: JSON.stringify({ type: 'done' }),
					});
					observer.complete();
				} catch (err) {
					console.error('Error sending message:', err);
					observer.error(err);
				}
			})();

			return () => {
				controller.abort();
			};
		});
	}

	async removeDocument(chatId: string, documentId: string, userId: string) {
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
			with: {
				documents: true,
			},
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		const documentToRemove = chat.documents.find(
			(doc) => doc.id === documentId
		);

		if (!documentToRemove) {
			throw new BadRequestException('Document not found in this chat');
		}

		const errors: string[] = [];

		// Step 1: Delete all chunks from ChromaDB (best effort)
		try {
			const collection = await this.getOrCreateCollection();

			const queryResult = await collection.get({
				where: {
					documentId: String(documentId),
				},
			});

			if (queryResult.ids && queryResult.ids.length > 0) {
				await collection.delete({
					ids: queryResult.ids,
				});
			}
		} catch (err) {
			console.error('Error deleting from ChromaDB:', err);
			errors.push('Failed to delete from vector store');
		}

		// Step 2: Delete file from S3 (best effort)
		try {
			await this.s3Service.deleteObject(
				'user-docs',
				documentToRemove.s3key
			);
		} catch (err) {
			console.error('Error deleting from S3:', err);
			errors.push('Failed to delete from cloud storage');
		}

		// Step 3: Always delete document record from database (critical)
		try {
			await this.databaseService.db
				.delete(documents)
				.where(
					and(
						eq(documents.id, documentId),
						eq(documents.chatId, chatId),
						eq(documents.userId, userId)
					)
				);
		} catch (err) {
			console.error('Error deleting document from database:', err);
			throw new InternalServerErrorException(
				'Failed to delete document record from database'
			);
		}

		// Return success even if some cleanup steps failed
		if (errors.length > 0) {
			console.warn(
				`Document ${documentId} removed with warnings:`,
				errors
			);
		}

		return {
			message: 'Document removed successfully',
		};
	}

	async getChats(userId: string) {
		const userChats = await this.databaseService.db
			.select()
			.from(chats)
			.where(
				and(
					eq(chats.userId, userId),
					exists(
						this.databaseService.db
							.select()
							.from(chatMessages)
							.where(eq(chatMessages.chatId, chats.id))
					)
				)
			)
			.orderBy(desc(chats.createdAt));

		return {
			message: 'Chats retrieved successfully',
			data: {
				chats: userChats,
			},
		};
	}

	async getChat(chatId: string, userId: string) {
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
			with: {
				messages: true,
				documents: {
					columns: {
						vectorStoreFileId: false,
						vectorStoreId: false,
					},
				},
			},
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		return {
			message: 'Chat retrieved successfully',
			data: chat,
		};
	}

	async deleteChat(chatId: string, userId: string) {
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		await this.databaseService.db.delete(chats).where(eq(chats.id, chatId));

		return;
	}

	async createChat(userId: string, chatId?: string) {
		const chatValues: any = {
			userId,
			title: this.DEFAULT_CHAT_NAME,
		};

		if (chatId) {
			chatValues.id = chatId;
		}

		try {
			const newChat = await this.databaseService.db
				.insert(chats)
				.values(chatValues)
				.returning();

			return {
				message: 'Chat created successfully',
				chatId: newChat[0].id,
				title: newChat[0].title,
				createdAt: newChat[0].createdAt,
			};
		} catch (error: any) {
			// Check for PostgreSQL unique violation error in Drizzle error or its cause
			const errorCode = error?.code || error?.cause?.code;
			const errorConstraint =
				error?.constraint || error?.cause?.constraint;

			if (errorCode === '23505' || errorConstraint === 'chats_pkey') {
				throw new ConflictException(
					'A chat with this ID already exists'
				);
			}
			throw error;
		}
	}

	async updateMessageFeedback(
		chatId: string,
		messageId: string,
		userId: string,
		helpful: boolean
	) {
		// Verify chat belongs to user
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		// Verify message belongs to the chat
		const message =
			await this.databaseService.db.query.chatMessages.findFirst({
				where: and(
					eq(chatMessages.id, messageId),
					eq(chatMessages.chatId, chatId)
				),
			});

		if (!message) {
			throw new BadRequestException('Message not found in this chat');
		}

		// Update the helpful status
		await this.databaseService.db
			.update(chatMessages)
			.set({ helpful })
			.where(eq(chatMessages.id, messageId));

		return {
			message: 'Feedback updated successfully',
			messageId,
			helpful,
		};
	}

	async getSignedDocumentUrl(
		chatId: string,
		documentId: string,
		userId: string
	) {
		// Verify chat belongs to user
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
			with: {
				documents: true,
			},
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		// Verify document belongs to the chat
		const document = chat.documents.find((doc) => doc.id === documentId);

		if (!document) {
			throw new BadRequestException('Document not found in this chat');
		}

		// Generate signed URL (expires in 1 day)
		const signedUrl = await this.s3Service.getSignedUrl(
			'user-docs',
			document.s3key,
			86400 // 1 day (24 hours)
		);

		return {
			message: 'Signed URL generated successfully',
			data: {
				signedUrl,
				fileName: document.fileName,
				documentId: document.id,
				expiresIn: 86400,
			},
		};
	}
}
