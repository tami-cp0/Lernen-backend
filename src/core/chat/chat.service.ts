import {
	BadRequestException,
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
import { and, desc, eq } from 'drizzle-orm';
import { chatMessages, chats } from 'src/database/schema';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { CloudClient } from 'chromadb';

/**
 * Custom OpenAI Embedding Function for ChromaDB
 */
// class OpenAIEmbeddingFunction {
// 	private openai: OpenAI;

// 	constructor(openaiApiKey: string) {
// 		this.openai = new OpenAI({ apiKey: openaiApiKey });
// 	}

// 	async generate(texts: string[]): Promise<number[][]> {
// 		const response = await this.openai.embeddings.create({
// 			model: 'text-embedding-3-small',
// 			input: texts,
// 		});
// 		return response.data.map((item) => item.embedding);
// 	}
// }

@Injectable()
export class ChatService {
// 	private openai: OpenAI;
// 	private chromaClient: CloudClient;
// 	private embeddingFunction: OpenAIEmbeddingFunction;
// 	private collectionName = 'documents';

// 	constructor(
// 		private configService: ConfigService,
// 		private databaseService: DatabaseService
// 	) {
// 		const openaiKey =
// 			this.configService.get<OpenAIConfigType>('openai')!.key!;

// 		this.openai = new OpenAI({
// 			apiKey: openaiKey,
// 		});

// 		this.embeddingFunction = new OpenAIEmbeddingFunction(openaiKey);

// 		this.chromaClient = new CloudClient({
// 			apiKey: this.configService.get<ChromaConfigType>('chroma')!.apiKey!,
// 			tenant: this.configService.get<ChromaConfigType>('chroma')!.tenant,
// 			database:
// 				this.configService.get<ChromaConfigType>('chroma')!.database,
// 		});
// 	}

// 	/**
// 	 * Helper: Generate embeddings using OpenAI API directly
// 	 */
// 	private async generateEmbeddings(texts: string[]): Promise<number[][]> {
// 		const response = await this.openai.embeddings.create({
// 			model: 'text-embedding-3-small',
// 			input: texts,
// 		});
// 		return response.data.map((item) => item.embedding);
// 	}

// 	/**
// 	 * Helper: Get or create collection
// 	 */
// 	private async getOrCreateCollection() {
// 		try {
// 			return await this.chromaClient.getOrCreateCollection({
// 				name: this.collectionName,
// 				metadata: { 'hnsw:space': 'cosine' },
// 				embeddingFunction: this.embeddingFunction,
// 			});
// 		} catch (error) {
// 			console.error('Error getting/creating collection:', error);
// 			throw new InternalServerErrorException(
// 				'Failed to access vector store'
// 			);
// 		}
// 	}

// 	/**
// 	 * Upload and process PDF documents using ChromaDB directly
// 	 * Flow: PDF → extract text per page → chunk → embed → store in Chroma
// 	 */
// 	async uploadDocumentNonApi(
// 		files: Array<Express.Multer.File>,
// 		chatId: string | 'new',
// 		userId: string,
// 		message?: string
// 	) {
// 		// Validate file upload
// 		if (!files || files.length === 0) {
// 			throw new BadRequestException('No files uploaded');
// 		}

// 		// Only PDF files are supported
// 		const pdfFiles = files.filter(
// 			(file) => file.mimetype === 'application/pdf'
// 		);
// 		if (pdfFiles.length === 0) {
// 			throw new BadRequestException('Only PDF files are supported');
// 		}

// 		if (chatId && chatId !== 'new') {
// 			const chat = await this.databaseService.db.query.chats.findFirst({
// 				where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
// 			});

// 			if (!chat) {
// 				throw new BadRequestException('Chat not found');
// 			}
// 		}

// 		const results: {
// 			success: { id: string; name: string }[];
// 			failed: { name: string; reason?: string }[];
// 		} = {
// 			success: [],
// 			failed: [],
// 		};

// 		const MAX_UPLOADS = 3;

// 		// Check existing documents to enforce upload limit
// 		let remainingSlots = MAX_UPLOADS;

// 		if (chatId !== 'new') {
// 			const existingDocuments = await this.databaseService.db
// 				.select()
// 				.from(documents)
// 				.where(
// 					and(
// 						eq(documents.chatId, chatId),
// 						eq(documents.userId, userId)
// 					)
// 				);

// 			remainingSlots = MAX_UPLOADS - existingDocuments.length;
// 			remainingSlots = Math.max(remainingSlots, 0);
// 		}

// 		if (remainingSlots <= 0) {
// 			return {
// 				message: `You have used up the available upload slots (${MAX_UPLOADS}).`,
// 				successfulUploads: [],
// 				failedUploads: pdfFiles.map((file) => ({
// 					name: file.originalname,
// 				})),
// 			};
// 		}

// 		// Create new chat ONCE before processing files
// 		if (chatId === 'new') {
// 			const newChatId = (
// 				await this.databaseService.db
// 					.insert(chats)
// 					.values({
// 						userId,
// 						title:
// 							message?.slice(0, 16) ||
// 							pdfFiles[0].originalname.slice(0, 16),
// 					})
// 					.returning()
// 			)[0].id;

// 			chatId = newChatId;
// 		}

// 		// Get or create collection
// 		const collection = await this.getOrCreateCollection();

// 		for (const file of pdfFiles) {
// 			if (remainingSlots <= 0) {
// 				results.failed.push({
// 					name: file.originalname,
// 					reason: 'No remaining upload slots',
// 				});
// 				continue;
// 			}

// 			try {
// 				// Step 1: Extract text from PDF using pdfjs-dist (page-by-page)
// 				const dataBuffer = fs.readFileSync(file.path);
// 				const uint8Array = new Uint8Array(dataBuffer);
// 				const pdf = await pdfjsLib.getDocument({ data: uint8Array })
// 					.promise;

// 				// Accumulate page texts with metadata
// 				interface PageData {
// 					text: string;
// 					page: number;
// 				}
// 				const pageData: PageData[] = [];

// 				// Extract text per page with metadata
// 				for (let i = 1; i <= pdf.numPages; i++) {
// 					const page = await pdf.getPage(i);
// 					const textContent = await page.getTextContent();
// 					const pageText = textContent.items
// 						.map((item: any) => item.str)
// 						.join(' ');

// 					pageData.push({
// 						text: pageText,
// 						page: i,
// 					});
// 				}

// 				// Step 2: Chunk text using RecursiveCharacterTextSplitter
// 				const textSplitter = new RecursiveCharacterTextSplitter({
// 					chunkSize: 1000,
// 					chunkOverlap: 200,
// 				});

// 				// Split each page's text
// 				const allChunks: Array<{
// 					text: string;
// 					page: number;
// 				}> = [];

// 				for (const pageInfo of pageData) {
// 					const chunks = await textSplitter.splitText(pageInfo.text);
// 					chunks.forEach((chunk) => {
// 						allChunks.push({
// 							text: chunk,
// 							page: pageInfo.page,
// 						});
// 					});
// 				}

// 				// Step 3: Save document metadata to database first to get document ID
// 				const [documentRecord] = await this.databaseService.db
// 					.insert(documents)
// 					.values({
// 						chatId,
// 						userId,
// 						fileName: file.originalname,
// 						fileType: file.mimetype,
// 						fileSize: file.size,
// 						vectorStoreId: `chat_${chatId}`,
// 						vectorStoreFileId: `${chatId}_${Date.now()}`,
// 					})
// 					.returning();

// 				// Step 4: Generate embeddings for all chunks
// 				const chunkTexts = allChunks.map((c) => c.text);
// 				const embeddings = await this.generateEmbeddings(chunkTexts);

// 				// Step 5: Prepare data for ChromaDB
// 				const ids: string[] = [];
// 				const metadatas: Array<Record<string, any>> = [];
// 				const chromaDocs: string[] = [];

// 				allChunks.forEach((chunk, index) => {
// 					ids.push(`${documentRecord.id}_chunk_${index}`);
// 					metadatas.push({
// 						documentId: String(documentRecord.id),
// 						fileName: file.originalname,
// 						chatId: String(chatId),
// 						userId: String(userId),
// 						page: chunk.page,
// 						source: file.originalname,
// 					});
// 					chromaDocs.push(chunk.text);
// 				});

// 				// Step 6: Add to ChromaDB collection
// 				await collection.add({
// 					ids,
// 					embeddings,
// 					metadatas,
// 					documents: chromaDocs,
// 				});

// 				results.success.push({
// 					id: documentRecord.id,
// 					name: documentRecord.fileName,
// 				});
// 				remainingSlots--;

// 				// Clean up uploaded file from disk
// 				fs.unlinkSync(file.path);
// 			} catch (err) {
// 				console.error('Error processing PDF:', err);
// 				results.failed.push({
// 					name: file.originalname,
// 					reason:
// 						err instanceof Error ? err.message : 'Unknown error',
// 				});
// 			}
// 		}

// 		return {
// 			message:
// 				results.failed.length > 0
// 					? `Some files failed to upload`
// 					: 'All files uploaded successfully',
// 			remainingSlots,
// 			chatId,
// 			successfulUploads: results.success,
// 			failedUploads: results.failed,
// 		};
// 	}

// 	/**
// 	 * Send message with RAG using ChromaDB directly
// 	 * Flow: Query → Retrieve similar chunks → LLM response with context
// 	 */
// 	async sendMessageNonApi(
// 		chatId: string | 'new',
// 		message: string,
// 		userId: string,
// 		selectedDocumentIds?: string[]
// 	) {
// 		// Create new chat if needed
// 		if (chatId === 'new') {
// 			const newChatId = (
// 				await this.databaseService.db
// 					.insert(chats)
// 					.values({
// 						userId,
// 						title: message.slice(0, 16),
// 					})
// 					.returning()
// 			)[0].id;
// 			chatId = newChatId;
// 		}

// 		// Verify chat exists and belongs to user
// 		const chat = await this.databaseService.db.query.chats.findFirst({
// 			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
// 			with: { documents: true },
// 		});

// 		if (!chat) {
// 			throw new BadRequestException('Chat not found');
// 		}

// 		try {
// 			// Step 1: Get collection
// 			const collection = await this.getOrCreateCollection();

// 			// Step 2: Generate embedding for the query
// 			const [queryEmbedding] = await this.generateEmbeddings([message]);

// 			// Step 3: Build metadata filter
// 			const whereFilter: Record<string, any> = {
// 				$and: [{ chatId: String(chatId) }, { userId: String(userId) }],
// 			};

// 			// Add document filter if specific documents are selected
// 			if (selectedDocumentIds && selectedDocumentIds.length > 0) {
// 				whereFilter.$and.push({
// 					documentId: { $in: selectedDocumentIds },
// 				});
// 			}

// 			// Step 4: Query ChromaDB for similar chunks
// 			const queryResult = await collection.query({
// 				queryEmbeddings: [queryEmbedding],
// 				nResults: 4,
// 				where: whereFilter,
// 			});

// 			// Step 5: Format retrieved documents
// 			const retrievedDocs = queryResult.documents[0] || [];
// 			const retrievedMetadatas = queryResult.metadatas[0] || [];

// 			// Build context from retrieved documents
// 			const context = retrievedDocs
// 				.map((doc, idx) => {
// 					const metadata = retrievedMetadatas[idx];
// 					return `[Page ${metadata?.page || 'N/A'} - ${
// 						metadata?.fileName || 'Unknown'
// 					}]\n${doc}`;
// 				})
// 				.join('\n\n');

// 			// Step 6: Create prompt for LLM
// 			const prompt = `Answer the question based only on the following context. If you cannot answer the question based on the context, say "I don't have enough information to answer that question."

// Context:
// ${context}

// Question: ${message}

// Answer:`;

// 			// Step 7: Get response from OpenAI
// 			const completion = await this.openai.chat.completions.create({
// 				model: 'gpt-4-turbo-preview',
// 				messages: [
// 					{
// 						role: 'system',
// 						content:
// 							'You are a helpful assistant that answers questions based on the provided context.',
// 					},
// 					{
// 						role: 'user',
// 						content: prompt,
// 					},
// 				],
// 				temperature: 0.7,
// 			});

// 			const assistantMessage =
// 				completion.choices[0]?.message?.content ||
// 				'No response generated';

// 			// Step 8: Save message to database
// 			const [savedMessage] = await this.databaseService.db
// 				.insert(chatMessages)
// 				.values({
// 					chatId,
// 					turn: {
// 						user: message,
// 						assistant: assistantMessage,
// 					},
// 					totalTokens: completion.usage?.total_tokens || 0,
// 				})
// 				.returning();

// 			return {
// 				message: 'Message sent successfully',
// 				data: {
// 					message: savedMessage,
// 					sourceDocuments: retrievedMetadatas.map(
// 						(metadata, idx) => ({
// 							page: metadata?.page,
// 							source: metadata?.source || metadata?.fileName,
// 							content: retrievedDocs[idx]?.slice(0, 200) + '...',
// 						})
// 					),
// 				},
// 			};
// 		} catch (err) {
// 			console.error('Error sending message:', err);
// 			throw new InternalServerErrorException(
// 				err instanceof Error ? err.message : 'Error processing message'
// 			);
// 		}
// 	}

	// flow for sending message with an attached document is to always upload the document first
	// then send the message with the returned chatId

	// old uploadDocument method

	// async uploadDocument(
	// 	files: Array<Express.Multer.File>,
	// 	chatId: string | 'new',
	// 	userId: string,
	// 	message?: string
	// ) {
	// 	// handle pdf and docx confirmation and viruses in file later.

	// 	if (!files || files.length === 0) {
	// 		throw new BadRequestException('No files uploaded');
	// 	}

	// 	if (chatId && chatId !== 'new') {
	// 		const chat = await this.databaseService.db.query.chats.findFirst({
	// 			where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
	// 		});

	// 		if (!chat) {
	// 			throw new BadRequestException('Chat not found');
	// 		}
	// 	}

	// 	const results: {
	// 		success: { id: string; name: string }[];
	// 		failed: { name: string; reason?: string }[];
	// 	} = {
	// 		success: [],
	// 		failed: [],
	// 	};

	// 	const MAX_UPLOADS = 3;

	// 	const existingDocuments = await this.databaseService.db
	// 		.select()
	// 		.from(documents)
	// 		.where(
	// 			and(eq(documents.chatId, chatId), eq(documents.userId, userId))
	// 		);

	// 	let remainingSlots = MAX_UPLOADS - existingDocuments.length;
	// 	remainingSlots = Math.max(remainingSlots, 0); // Ensure non-negative

	// 	if (remainingSlots <= 0) {
	// 		return {
	// 			message: `You have used up the available upload slots (${MAX_UPLOADS}).`,
	// 			successfulUploads: [],
	// 			failedUploads: files.map((file) => ({
	// 				name: file.originalname,
	// 			})),
	// 		};
	// 	}

	// 	for (const file of files) {
	// 		if (remainingSlots <= 0) {
	// 			results.failed.push({
	// 				name: file.originalname,
	// 				reason: 'No remaining upload slots',
	// 			});
	// 			continue;
	// 		}

	// 		if (chatId === 'new') {
	// 			const newChatId = (
	// 				await this.databaseService.db
	// 					.insert(chats)
	// 					.values({
	// 						userId,
	// 						title: message?.slice(0, 16),
	// 					})
	// 					.returning()
	// 			)[0].id;

	// 			chatId = newChatId;
	// 		}

	// 		try {
	// 			const vectorStoreId =
	// 				this.configService.get<OpenAIConfigType>('openai')!
	// 					.vectorStoreId!;
	// 			const stream = fs.createReadStream(file.path);
	// 			const wrapped = await toFile(stream, file.originalname);

	// 			const fileObject =
	// 				await this.openai.vectorStores.files.uploadAndPoll(
	// 					vectorStoreId,
	// 					wrapped
	// 				);

	// 			if (fileObject.status === 'failed') {
	// 				results.failed.push({
	// 					name: file.originalname,
	// 					reason: 'Processing failed in OpenAI',
	// 				});
	// 				continue;
	// 			}

	// 			// attach attributes
	// 			await this.openai.vectorStores.files.create(vectorStoreId, {
	// 				file_id: fileObject.id,
	// 				attributes: {
	// 					userId,
	// 					chatId,
	// 				},
	// 			});

	// 			const [document] = await this.databaseService.db
	// 				.insert(documents)
	// 				.values({
	// 					chatId,
	// 					userId,
	// 					fileName: file.originalname,
	// 					fileType: file.mimetype,
	// 					fileSize: file.size,
	// 					vectorStoreId,
	// 					vectorStoreFileId: fileObject.id,
	// 				})
	// 				.returning();

	// 			results.success.push({
	// 				id: document.id,
	// 				name: document.fileName,
	// 			});
	// 			remainingSlots--;
	// 		} catch (err) {
	// 			console.log(err);
	// 			results.failed.push({
	// 				name: file.originalname,
	// 				reason:
	// 					err instanceof Error ? err.message : 'Unknown error',
	// 			});
	// 		}
	// 	}

	// 	return {
	// 		message:
	// 			results.failed.length > 0
	// 				? `Some files failed to upload`
	// 				: 'All files uploaded successfully',
	// 		remainingSlots,
	// 		chatId,
	// 		successfulUploads: results.success,
	// 		failedUploads: results.failed,
	// 	};
	// }

	// async removeDocument(chatId: string, documentId: string, userId: string) {
	// 	const chat = await this.databaseService.db.query.chats.findFirst({
	// 		where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
	// 		with: {
	// 			documents: true,
	// 		},
	// 	});

	// 	if (!chat) {
	// 		throw new BadRequestException('Chat not found');
	// 	}

	// 	const documentToRemove = chat.documents.find(
	// 		(doc) => doc.id === documentId
	// 	);

	// 	if (!documentToRemove) {
	// 		throw new BadRequestException('Document not found in this chat');
	// 	}

	// 	try {
	// 		// Get collection
	// 		const collection = await this.getOrCreateCollection();

	// 		// Delete all chunks associated with this document from ChromaDB
	// 		// Query for all chunks with this documentId
	// 		const chunkIds: string[] = [];

	// 		// find all chunk IDs that match his document
	// 		// stored as `${documentId}_chunk_${index}`, query by metadata
	// 		const queryResult = await collection.get({
	// 			where: {
	// 				documentId: String(documentId),
	// 			},
	// 		});

	// 		// Delete the chunks if found
	// 		if (queryResult.ids && queryResult.ids.length > 0) {
	// 			await collection.delete({
	// 				ids: queryResult.ids,
	// 			});
	// 		}

	// 		// Delete document record from database
	// 		await this.databaseService.db
	// 			.delete(documents)
	// 			.where(
	// 				and(
	// 					eq(documents.id, documentId),
	// 					eq(documents.chatId, chatId),
	// 					eq(documents.userId, userId)
	// 				)
	// 			);

	// 		return {
	// 			message: 'Document removed successfully',
	// 		};
	// 	} catch (err) {
	// 		console.error('Error removing document:', err);
	// 		throw new InternalServerErrorException(
	// 			err instanceof Error ? err.message : 'Error removing document'
	// 		);
	// 	}
	// }

	// async getChats(userId: string) {
	// 	const chats = await this.databaseService.db
	// 		.select()
	// 		.from(documents)
	// 		.where(eq(documents.userId, userId))
	// 		.orderBy(desc(documents.createdAt));

	// 	return {
	// 		message: 'Chats retrieved successfully',
	// 		data: chats,
	// 	};
	// }

	// async getChat(chatId: string, userId: string) {
	// 	const chat = await this.databaseService.db.query.chats.findFirst({
	// 		where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
	// 		with: {
	// 			messages: true,
	// 			documents: {
	// 				columns: {
	// 					vectorStoreFileId: false,
	// 					vectorStoreId: false,
	// 				},
	// 			},
	// 		},
	// 	});

	// 	if (!chat) {
	// 		throw new BadRequestException('Chat not found');
	// 	}

	// 	return {
	// 		message: 'Chat retrieved successfully',
	// 		data: chat,
	// 	};
	// }

	// async deleteChat(chatId: string, userId: string) {
	// 	const chat = await this.databaseService.db.query.chats.findFirst({
	// 		where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
	// 	});

	// 	if (!chat) {
	// 		throw new BadRequestException('Chat not found');
	// 	}

	// 	await this.databaseService.db.delete(chats).where(eq(chats.id, chatId));

	// 	return;
	// }

	// old sendMessage method

	// async sendMessage(chatId: string | 'new', message: string, userId: string) {
	// 	if (chatId === 'new') {
	// 		const newChatId = (
	// 			await this.databaseService.db
	// 				.insert(chats)
	// 				.values({
	// 					userId,
	// 					title: message.slice(0, 16),
	// 				})
	// 				.returning()
	// 		)[0].id;

	// 		chatId = newChatId;
	// 	}

	// 	const chat = await this.databaseService.db.query.chats.findFirst({
	// 		where: and(eq(chats.id, chatId!), eq(chats.userId, userId)),
	// 		with: {
	// 			documents: true,
	// 		},
	// 	});

	// 	if (!chat && chatId !== 'new') {
	// 		throw new BadRequestException('Chat not found');
	// 	}

	// 	let response: any;
	// 	let messages: typeof chatMessages.$inferInsert;

	// 	try {
	// 		response = await this.openai.responses.create({
	// 			model: 'gpt-4.1-mini',
	// 			input: message,
	// 			tools: [
	// 				{
	// 					type: 'file_search',
	// 					vector_store_ids: [
	// 						this.configService.get<OpenAIConfigType>('openai')!
	// 							.vectorStoreId!,
	// 					],
	// 				},
	// 			],
	// 		});

	// 		[messages] = await this.databaseService.db
	// 			.insert(chatMessages)
	// 			.values({
	// 				chatId: chatId!,
	// 				turn: {
	// 					user: message,
	// 					assistant: response.output_text,
	// 				},
	// 				totalTokens: response.usage.total_tokens,
	// 			})
	// 			.returning();

	// 		console.log('Response from OpenAI:', response);
	// 	} catch (err) {
	// 		if (err instanceof OpenAI.APIError) {
	// 			throw new InternalServerErrorException(err.message);
	// 		}

	// 		throw new InternalServerErrorException('Unexpected error occurred');
	// 	}

	// 	return {
	// 		message: 'Message sent successfully',
	// 		data: {
	// 			message: messages,
	// 		},
	// 	};
	// }
}

// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMGQ0YmQwYy0zNTNkLTQ1NzYtYTJjYS1lNWZhYjQ0YTY1YjAiLCJlbWFpbCI6ImZpbmR0YW1pbG9yZUBnbWFpbC5jb20iLCJyb2xlIjoibGVhcm5lciIsInByb3ZpZGVyIjoiZW1haWwiLCJpYXQiOjE3NTUyNzM1NDksImV4cCI6MTc1NTg3ODM0OX0.W2dYDj4z5dXg_OuPKRXBYAgYyhpcFi4pdBekclo-01M
