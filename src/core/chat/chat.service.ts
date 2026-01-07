import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	UploadedFiles,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import * as fs from 'fs';
import { DatabaseService } from 'src/database/database.service';
import { documents } from 'src/database/schema/documents';
import { ChromaConfigType, OpenAIConfigType } from 'src/config/config.types';
import { and, desc, eq, exists, sql } from 'drizzle-orm';
import { chatMessages, chats, users } from 'src/database/schema';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { CloudClient } from 'chromadb';
import { S3Service } from 'src/common/services/s3/s3.service';

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

	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
		private s3Service: S3Service
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
	}

	/**
	 * Helper: Generate embeddings using OpenAI API directly
	 */
	private async generateEmbeddings(texts: string[]): Promise<number[][]> {
		const response = await this.openai.embeddings.create({
			model: 'text-embedding-3-small',
			input: texts,
		});
		return response.data.map((item) => item.embedding);
	}

	/**
	 * Helper: Get or create collection
	 */
	private async getOrCreateCollection() {
		try {
			return await this.chromaClient.getOrCreateCollection({
				name: this.collectionName,
				metadata: { 'hnsw:space': 'cosine' },
				embeddingFunction: this.embeddingFunction,
			});
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

		if (chatId && chatId !== 'new') {
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

		if (chatId !== 'new') {
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
		}

		if (remainingSlots <= 0) {
			return {
				message: `You have used up the available upload slots (${MAX_UPLOADS}).`,
				successfulUploads: [],
				failedUploads: pdfFiles.map((file) => ({
					name: file.originalname,
				})),
			};
		}

		// Create new chat ONCE before processing files
		if (chatId === 'new') {
			const newChatId = (
				await this.databaseService.db
					.insert(chats)
					.values({
						userId,
						title:
							message?.slice(0, 16) ||
							pdfFiles[0].originalname.slice(0, 16),
					})
					.returning()
			)[0].id;

			chatId = newChatId;
		}

		// Get or create collection
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

				// Extract text from PDF using pdfjs-dist (page-by-page)
				// Dynamic import for ES module
				const pdfjsLib = await import(
					'pdfjs-dist/legacy/build/pdf.mjs'
				);

				const uint8Array = new Uint8Array(fileBuffer);
				const pdf = await pdfjsLib.getDocument({ data: uint8Array })
					.promise;

				// Accumulate page texts with metadata
				interface PageData {
					text: string;
					page: number;
				}
				const pageData: PageData[] = [];

				// Extract text per page with metadata
				for (let i = 1; i <= pdf.numPages; i++) {
					const page = await pdf.getPage(i);
					const textContent = await page.getTextContent();
					const pageText = textContent.items
						.map((item: any) => item.str)
						.join(' ');

					pageData.push({
						text: pageText,
						page: i,
					});
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

				// Step 5: Add to ChromaDB collection
				await collection.add({
					ids,
					embeddings,
					metadatas,
					documents: chromaDocs,
				});

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
	async sendMessageNonApi(
		chatId: string | 'new',
		message: string,
		userId: string,
		selectedDocumentIds?: string[],
		helpful?: boolean,
		pageNumber?: number,
		pageContent?: string
	) {
		console.log(selectedDocumentIds, pageNumber);
		// Create new chat if needed
		if (chatId === 'new') {
			const newChatId = (
				await this.databaseService.db
					.insert(chats)
					.values({
						userId,
						title: message.slice(0, 16),
					})
					.returning()
			)[0].id;
			chatId = newChatId;
		}

		// Verify chat exists and belongs to user
		const chat = await this.databaseService.db.query.chats.findFirst({
			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
			with: { documents: true },
		});

		if (!chat) {
			throw new BadRequestException('Chat not found');
		}

		const user = await this.databaseService.db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		try {
			let context = '';
			let retrievedMetadatas: any[] = [];
			let retrievedDocs: any[] = [];

			// Only perform retrieval if chat has documents AND documents are selected
			const shouldRetrieve =
				chat.documents &&
				chat.documents.length > 0 &&
				selectedDocumentIds &&
				selectedDocumentIds.length > 0;

			if (shouldRetrieve) {
				// Step 1: Get collection
				const collection = await this.getOrCreateCollection();

				// Step 2: Generate embedding for the query
				const [queryEmbedding] = await this.generateEmbeddings([
					message,
				]);

				// Step 3: Build metadata filter
				const whereFilter: Record<string, any> = {
					$and: [
						{ chatId: String(chatId) },
						{ userId: String(userId) },
						{ documentId: { $in: selectedDocumentIds } },
					],
				};

				// Step 4: Query ChromaDB for similar chunks
				const queryResult = await collection.query({
					queryEmbeddings: [queryEmbedding],
					nResults: 4,
					where: whereFilter,
				});

				// Step 5: Format retrieved documents
				retrievedDocs = queryResult.documents[0] || [];
				retrievedMetadatas = queryResult.metadatas[0] || [];

				// Build context from retrieved documents
				context = retrievedDocs
					.map((doc, idx) => {
						const metadata = retrievedMetadatas[idx];
						return `[Page ${metadata?.page || 'N/A'} - ${
							metadata?.fileName || 'Unknown'
						}]\n${doc}`;
					})
					.join('\n\n');
			}

			// Step 6: Create prompt for LLM
			let prompt = '';

			if (context) {
				prompt = `User education level: ${user?.educationLevel}

			Document:
			${context}`;
			} else {
				prompt = `User education level: ${user?.educationLevel}`;
			}

			// Add page context if provided
			if (pageNumber && pageContent) {
				prompt += `\n\nUser is currently viewing page ${pageNumber} which contains the following content:\n${pageContent}`;
			}

			prompt += `\n\nQuestion: ${message}`;

			// Step 7: Get response from OpenAI
			const completion = await this.openai.chat.completions.create({
				model: 'gpt-4-turbo-preview',
				messages: [
					{
						role: 'system',
						content: `
You are a distinguished professor who teaches using an interactive, dialogue-driven approach. You answer questions strictly based on the user’s input (originating from a document), but you must never mention “context,” “provided context,” or similar phrases.
You do not create courses or progressive learning paths unless explicitly requested.
Avoid lengthy bullet lists. ocassionaly refer to page numbers and document using the document name when relevant.

All responses must use markdown only to improve clarity.

Markdown Rules

Use headings and subheadings.

Use blockquotes only when quoting text.

Horizontal rules (---) to seperate sections or headings and is a must use when relevant.

Use lists, bold, italics, code blocks, or tables when they improve clarity.

Teaching Style

Clarity & rigor: concise, academically precise explanations.

Interactivity: ask Socratic follow-up questions when appropriate.

Real-world integration: use examples or analogies when helpful.

Adaptive response: adjust explanations if the learner seems confused.

No assumed curriculum: never build modules unless explicitly asked.

Mandatory Quiz Format

If the user asks for:

a quiz

multiple-choice questions

comprehension checks

practice questions

or says “test me,” “ask me questions,” etc.

You must output only this JSON structure:

{
  "questions": [
    {
      "question": "",
      "A": "",
      "B": "",
      "C": "",
      "D": "",
      "answer": "",
      "hint": ""
    }
  ]
}


No text outside the JSON block unless the user later requests an explanation.				
							`,
					},
					{
						role: 'user',
						content: prompt,
					},
				],
				temperature: 0.7,
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
					helpful: helpful ?? null,
				})
				.returning();

			console.log(retrievedMetadatas);

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
			title: 'Chat',
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
