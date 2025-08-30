import { ApiProperty } from '@nestjs/swagger';
import type { InferSelectModel } from 'drizzle-orm';
import { chatMessages, chats, documents } from 'src/database/schema';

export class ChatDTO implements InferSelectModel<typeof chats> {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Chat ID' })
    id: string;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'User ID who owns the chat' })
    userId: string;

    @ApiProperty({ example: 'My Document Chat', description: 'Chat title (max 16 characters)', maxLength: 16 })
    title: string;

    @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'Chat creation timestamp' })
    createdAt: Date;

    @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'Last update timestamp' })
    updatedAt: Date;
}

export class ChatMessageDTO implements InferSelectModel<typeof chatMessages> {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Message ID' })
    id: string;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Chat ID' })
    chatId: string;

    @ApiProperty({ 
        example: { user: "What is this document about?", assistant: "This document discusses..." }, 
        description: 'Message turn containing user and assistant messages' 
    })
    turn: { user: string; assistant: string };

    @ApiProperty({ example: 150, description: 'Total tokens used in this message turn' })
    totalTokens: number;

    @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'Message creation timestamp' })
    createdAt: Date;
}

export class DocumentDTO implements Omit<InferSelectModel<typeof documents>, 'vectorStoreId' | 'vectorStoreFileId'> {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Document ID' })
    id: string;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Chat ID' })
    chatId: string;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'User ID' })
    userId: string;

    @ApiProperty({ example: 'document.pdf', description: 'Original filename' })
    fileName: string;

    @ApiProperty({ example: 'application/pdf', description: 'File MIME type' })
    fileType: string;

    @ApiProperty({ example: 2048, description: 'File size in bytes' })
    fileSize: number;

    //omitted
    // @ApiProperty({ example: 'vs_abc123', description: 'OpenAI vector store ID' })
    // vectorStoreId: string;

    // @ApiProperty({ example: 'file_abc123', description: 'OpenAI vector store file ID' })
    // vectorStoreFileId: string;

    @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'Document creation timestamp' })
    createdAt: Date;

    @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'Document update timestamp' })
    updatedAt: Date;
}

class SendMessageDTO {
    @ApiProperty({ 
        type: ChatMessageDTO,
        description: 'The saved message record from database', 
    })
    message: ChatMessageDTO;
}

export class SendMessageResponseDTO {
    @ApiProperty({ example: 'Message sent successfully', description: 'Success message' })
    message: string;

    @ApiProperty({ 
        type: SendMessageDTO, 
        description: 'Message data containing saved record and AI response' 
    })
    data: SendMessageDTO;
}

export class ChatWithMessagesAndDocuments extends ChatDTO {
    @ApiProperty({ type: [ChatMessageDTO], description: 'Chat messages' })
    messages: ChatMessageDTO[];

    @ApiProperty({ type: [DocumentDTO], description: 'Chat documents' })
    documents: DocumentDTO[];
}

export class GetChatResponseDTO {
    @ApiProperty({ example: 'Chat retrieved successfully', description: 'Success message' })
    message: string;

    @ApiProperty({ type: ChatWithMessagesAndDocuments, description: 'Chat data with messages and documents' })
    data: ChatWithMessagesAndDocuments;
}

export class GetChatsResponseDTO {
    @ApiProperty({ example: 'Chats retrieved successfully', description: 'Success message' })
    message: string;

    @ApiProperty({ type: [ChatDTO], description: 'Array of user chats ordered by creation date (newest first)' })
    data: ChatDTO[];
}
