import { BadRequestException, Injectable, InternalServerErrorException, UploadedFiles } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import * as fs from 'fs';
import { DatabaseService } from 'src/database/database.service';
import { documents } from 'src/database/schema/documents';
import { OpenAIConfigType } from 'src/config/config.types';
import { and, desc, eq } from 'drizzle-orm';
import { chatMessages, chats } from 'src/database/schema';

@Injectable()
export class ChatService {
    private openai: OpenAI;

    constructor(
        private configService: ConfigService,
        private databaseService: DatabaseService
    ) {
        this.openai = new OpenAI();
    }

    // flow for sending message with an attached document is to always upload the document first
    // then send the message with the returned chatId

    async uploadDocument(files: Array<Express.Multer.File>, chatId: string | 'new', userId: string, message?: string) {
        // handle pdf and docx confirmation and viruses in file later.

        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }

        if (chatId && chatId !== 'new') {
            const chat = await this.databaseService.db.query.chats.findFirst({
                where: and(
                    eq(chats.id, chatId),
                    eq(chats.userId, userId)
                )
            });

            if (!chat) {
                throw new BadRequestException('Chat not found');
            }
        }

        const results: { 
            success: { id: string, name: string }[],
            failed: { name: string, reason?: string }[]
        } = {
            success: [],
            failed: []
        };

        const MAX_UPLOADS = 3;

        const existingDocuments = await this.databaseService.db
            .select()
            .from(documents)
            .where(
                and(
                    eq(documents.chatId, chatId),
                    eq(documents.userId, userId)
                )
            );

        let remainingSlots = MAX_UPLOADS - existingDocuments.length;
        remainingSlots = Math.max(remainingSlots, 0); // Ensure non-negative

        if (remainingSlots <= 0) {
            return {
                message: `You have used up the available upload slots (${MAX_UPLOADS}).`,
                successfulUploads: [],
                failedUploads: files.map(file => ({ name: file.originalname }))
            };
        }

        for (const file of files) {
            if (remainingSlots <= 0) {
                results.failed.push({ name: file.originalname, reason: 'No remaining upload slots' });
                continue;
            }

            if (chatId === 'new') {
                const newChatId = (await this.databaseService.db.insert(chats).values({
                    userId,
                    title: message?.slice(0, 16)
                }).returning())[0].id

                chatId = newChatId;
            }

            try {
                const vectorStoreId = this.configService.get<OpenAIConfigType>('openai')!.vectorStoreId!;
                const stream = fs.createReadStream(file.path);
                const wrapped = await toFile(stream, file.originalname);

                const fileObject = await this.openai.vectorStores.files.uploadAndPoll(
                    vectorStoreId,
                    wrapped
                );

                if (fileObject.status === 'failed') {
                    results.failed.push({ name: file.originalname, reason: 'Processing failed in OpenAI' });
                    continue;
                }

                // attach attributes
                await this.openai.vectorStores.files.create(vectorStoreId, {
                    file_id: fileObject.id,
                    attributes: {
                        userId,
                        chatId
                    },
                });

                const [document] = await this.databaseService.db.insert(documents).values({
                    chatId,
                    userId,
                    fileName: file.originalname,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    vectorStoreId,
                    vectorStoreFileId: fileObject.id,
                }).returning();

                results.success.push({ id: document.id, name: document.fileName });
                remainingSlots--;

            } catch (err) {
                console.log(err);
                results.failed.push({ 
                    name: file.originalname,
                    reason: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        }

        return {
            message: results.failed.length > 0
                ? `Some files failed to upload`
                : 'All files uploaded successfully',
            remainingSlots,
            chatId,
            successfulUploads: results.success,
            failedUploads: results.failed
        };
    }

    async removeDocument(chatId: string, documentId: string, userId: string) {
        const chat = await this.databaseService.db.query.chats.findFirst({
            where: and(
                eq(chats.id, chatId),
                eq(chats.userId, userId)
            ),
            with: {
                documents: {
                    columns: {
                        id: true,
                        vectorStoreFileId: true,
                        vectorStoreId: true
                    }
                }
            }
        });

        if (!chat) {
            throw new BadRequestException('Chat not found');
        }

        if (!chat.documents.some(doc => doc.id === documentId)) {
            throw new BadRequestException('Document not found in this chat');
        }

        await this.openai.vectorStores.files.delete(
            chat.documents[0].vectorStoreFileId,
            {
                vector_store_id: chat.documents[0].vectorStoreId
            }
        );

        await this.openai.files.delete(chat.documents[0].vectorStoreFileId);

        await this.databaseService.db.delete(documents)
            .where(
                and(
                    eq(documents.id, documentId),
                    eq(documents.chatId, chatId),
                    eq(documents.userId, userId)
                )
            );
    }

    async getChats(userId: string) {
        const chats = await this.databaseService.db
            .select()
            .from(documents)
            .where(eq(documents.userId, userId))
            .orderBy(desc(documents.createdAt));

        return {
            message: 'Chats retrieved successfully',
            data: chats
        };
    }

    async getChat(chatId: string, userId: string) {
        const chat = await this.databaseService.db.query.chats.findFirst({
            where: and(
                eq(chats.id, chatId),
                eq(chats.userId, userId)
            ),
            with: {
                messages: true,
                documents: {
                    columns: {
                        vectorStoreFileId: false,
                        vectorStoreId: false
                    }
                }
            }
        });

        if (!chat) {
            throw new BadRequestException('Chat not found');
        }

        return {
            message: 'Chat retrieved successfully',
            data: chat
        };
    }

    async deleteChat(chatId: string, userId: string) {
        const chat = await this.databaseService.db.query.chats.findFirst({
            where: and(
                eq(chats.id, chatId),
                eq(chats.userId, userId)
            )
        });

        if (!chat) {
            throw new BadRequestException('Chat not found');
        }

        await this.databaseService.db.delete(chats).where(eq(chats.id, chatId));

        return;
    }

    async sendMessage(chatId: string | 'new', message: string, userId: string) {
        if (chatId === 'new') {
            const newChatId = (await this.databaseService.db.insert(chats).values({
                userId,
                title: message.slice(0, 16)
            }).returning())[0].id;

            chatId = newChatId;
        }

        const chat = await this.databaseService.db.query.chats.findFirst({
                where: and(
                    eq(chats.id, chatId!),
                    eq(chats.userId, userId)
                ),
                with: {
                    documents: true
                }
            });
        
        if (!chat && chatId !== 'new') {
            throw new BadRequestException('Chat not found');
        }

        let response: any;
        let messages: typeof chatMessages.$inferInsert;

        try {
            response = await this.openai.responses.create({
                model: 'gpt-4.1-mini',
                input: message,
                tools: [
                {
                    type: 'file_search',
                    vector_store_ids: [this.configService.get<OpenAIConfigType>('openai')!.vectorStoreId!],
                }
                ]
            });

            [messages] = await this.databaseService.db.insert(chatMessages).values({
                chatId: chatId!,
                turn: {
                    user: message,
                    assistant: response.output_text
                },
                totalTokens: response.usage.total_tokens
            }).returning();

            console.log('Response from OpenAI:', response);
        } catch (err) {
            if (err instanceof OpenAI.APIError) {
                throw new InternalServerErrorException(err.message);
            }

            throw new InternalServerErrorException('Unexpected error occurred');
        }

        return {
            message: 'Message sent successfully',
            data: {
                message: messages,
            }
        }
    }
}

// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMGQ0YmQwYy0zNTNkLTQ1NzYtYTJjYS1lNWZhYjQ0YTY1YjAiLCJlbWFpbCI6ImZpbmR0YW1pbG9yZUBnbWFpbC5jb20iLCJyb2xlIjoibGVhcm5lciIsInByb3ZpZGVyIjoiZW1haWwiLCJpYXQiOjE3NTUyNzM1NDksImV4cCI6MTc1NTg3ODM0OX0.W2dYDj4z5dXg_OuPKRXBYAgYyhpcFi4pdBekclo-01M