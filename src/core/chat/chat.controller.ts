import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
	Req,
	UploadedFiles,
	UseFilters,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt/jwt.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import ChatIdParamDTO from './dto/chatid.dto';
import RemoveDocBodyDTO from './dto/removeDoc.dto';
import SendMessageBodyDTO from './dto/sendMessage.dto';
import { UploadDocBodyDTO, UploadDocumentResponseDTO } from './dto/upload.dto';
import { MulterExceptionFilter } from '../../common/filters/multer.filter';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiConsumes,
	ApiCreatedResponse,
	ApiExtraModels,
	ApiInternalServerErrorResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiPayloadTooLargeResponse,
	ApiResponse,
	getSchemaPath,
} from '@nestjs/swagger';
import { ApiDefaultDocProtected } from 'src/swagger';
import {
	GetChatResponseDTO,
	GetChatsResponseDTO,
	SendMessageResponseDTO,
} from './dto/chatResponses.dto';
import { CreateChatBodyDTO, CreateChatResponseDTO } from './dto/createChat.dto';
import {
	UpdateFeedbackBodyDTO,
	UpdateFeedbackResponseDTO,
} from './dto/updateFeedback.dto';

@ApiExtraModels(
	UploadDocumentResponseDTO,
	GetChatResponseDTO,
	GetChatsResponseDTO,
	SendMessageResponseDTO,
	CreateChatResponseDTO,
	UpdateFeedbackResponseDTO
)
@Controller('chats')
export class ChatController {
	constructor(private chatService: ChatService) {}

	@ApiOperation({
		summary: 'Upload documents to a chat',
		description: `
            Uploads PDF or DOCX files to a specific chat or creates a new chat if chatId is "new".
            - Maximum 5 documents per chat (existing + new uploads combined)
            - Supported formats: PDF (.pdf) and Word documents (.docx)
            - Maximum file size: 10MB per file
            - Maximum 5 files per request
            - Maximum of 5 upload slots per chat
            - Files are processed through OpenAI's vector store for AI chat functionality
            - If chatId is "new", a new chat will be created using the optional message as title (first 16 chars)
        `,
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		description: 'Upload files with optional message',
		schema: {
			type: 'object',
			properties: {
				files: {
					type: 'array',
					items: {
						type: 'string',
						format: 'binary',
					},
					description:
						'PDF or DOCX files to upload (max 5 files, 10MB each)',
				},
				message: {
					type: 'string',
					description:
						'Optional message - used as chat title when creating new chat (first 16 characters)',
				},
			},
			required: ['files'],
		},
	})
	@ApiOkResponse({
		description: 'Documents upload result',
		schema: { $ref: getSchemaPath(UploadDocumentResponseDTO) },
	})
	@ApiBadRequestResponse({
		description:
			'Invalid request - file validation, chat not found, or no files',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: {
					type: 'string',
					examples: [
						'No files uploaded',
						'Chat not found',
						'Only docx or pdf files are allowed!',
						'File too large',
					],
				},
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiPayloadTooLargeResponse({
		description: 'File size exceeds limit (10MB per file)',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 413 },
				message: { type: 'string', example: 'File too large' },
				error: { type: 'string', example: 'Payload Too Large' },
			},
		},
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@UseFilters(MulterExceptionFilter)
	@Post(':chatId/upload-document')
	@UseInterceptors(FilesInterceptor('files'))
	async uploadDocument(
		@UploadedFiles() files: Array<Express.Multer.File>,
		@Param() param: ChatIdParamDTO,
		@Body() body: UploadDocBodyDTO,
		@Req() req: Request
	) {
		return await this.chatService.uploadDocumentNonApi(
			files,
			param.chatId!,
			req!.user!.id,
			body.message
		);
	}

	@ApiOperation({
		summary: 'Remove a document from a chat',
		description: `
            Removes a specific document from a chat and cleans up associated resources.
            - Deletes the document from OpenAI's vector store
            - Removes the file from OpenAI's file storage
            - Removes the document record from the database
            - Only the document owner can remove their documents
            - Chat must belong to the authenticated user
        `,
	})
	@ApiBadRequestResponse({
		description: 'Chat not found or document not found in chat',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: {
					type: 'string',
					examples: [
						'Chat not found',
						'Document not found in this chat',
					],
				},
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiNoContentResponse({ description: 'doc has been deleted, no response' })
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Delete(':chatId/remove-document')
	async removeDocument(
		@Param() param: ChatIdParamDTO,
		@Body() body: RemoveDocBodyDTO,
		@Req() req: Request
	) {
		// return await this.chatService.removeDocument(param.chatId!, body.documentId, req.user!.id);
	}

	@ApiOperation({
		summary: 'Create a new chat',
		description: `
            Creates a new empty chat for the authenticated user.
            - Optionally accepts a custom UUID for the chat (if not provided, one will be auto-generated)
            - Chat is created with default title "Chat"
            - Returns the new chat ID, title, and creation timestamp
            - Chat is initially empty (no messages or documents)
            - Title can be set later when sending first message or uploading documents
        `,
	})
	@ApiCreatedResponse({
		description: 'Chat created successfully',
		schema: { $ref: getSchemaPath(CreateChatResponseDTO) },
	})
	@ApiBadRequestResponse({
		description: 'Invalid UUID format',
	})
	@ApiResponse({
		status: 409,
		description: 'A chat with this ID already exists',
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Post('create')
	@HttpCode(201)
	async createChat(@Req() req: Request, @Body() body: CreateChatBodyDTO) {
		return await this.chatService.createChat(req.user!.id, body.chatId);
	}

	@ApiOperation({
		summary: 'Get all chats for authenticated user',
		description: `
            Retrieves all chats belonging to the authenticated user.
            - Returns chats ordered by creation date (newest first)
            - Only returns chats owned by the authenticated user
            - Each chat includes basic information (id, title, timestamps)
        `,
	})
	@ApiOkResponse({
		description: 'Chats retrieved successfully',
		schema: { $ref: getSchemaPath(GetChatsResponseDTO) },
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Get()
	async getChats(@Req() req: Request) {
		return await this.chatService.getChats(req.user!.id);
	}

	@ApiOperation({
		summary: 'Get a specific chat with messages and documents',
		description: `
            Retrieves a specific chat belonging to the authenticated user with all associated messages and documents.
            - Returns chat details, messages, and uploaded documents
            - Only returns chats owned by the authenticated user
            - Messages include user and assistant turns with token counts
            - Documents include file metadata and vector store references
        `,
	})
	@ApiOkResponse({
		description: 'Chat retrieved successfully',
		schema: { $ref: getSchemaPath(GetChatResponseDTO) },
	})
	@ApiBadRequestResponse({
		description: 'Chat not found',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: { type: 'string', example: 'Chat not found' },
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Get(':chatId/messages')
	async getChat(@Param() param: ChatIdParamDTO, @Req() req: Request) {
		return await this.chatService.getChat(param.chatId!, req.user!.id);
	}

	@ApiOperation({
		summary: 'Delete a chat',
		description: `
            Permanently deletes a chat and all associated data.
            - Deletes the chat record from the database
            - Cascades to remove associated documents and messages (based on database constraints)
            - Only the chat owner can delete their chats
            - Returns 204 No Content on successful deletion
        `,
	})
	@ApiNoContentResponse({
		description: 'Chat deleted successfully',
	})
	@ApiBadRequestResponse({
		description: 'Chat not found',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: { type: 'string', example: 'Chat not found' },
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Delete(':chatId/delete')
	async deleteChat(@Param() param: ChatIdParamDTO, @Req() req: Request) {
		return await this.chatService.deleteChat(param.chatId!, req.user!.id);
	}

	@ApiOperation({
		summary: 'Send a message to a chat',
		description: `
            Sends a message to an existing chat or creates a new chat if chatId is "new".
            - Creates new chat if chatId is "new", using first 16 characters of message as title
            - Uses OpenAI GPT-4.1-mini with file search capabilities
            - Searches through uploaded documents in the chat's vector store
            - Saves the conversation turn (user + assistant messages) to database
            - Returns the AI assistant's response along with chat information
        `,
	})
	@ApiParam({
		name: 'chatId',
		description:
			'Chat ID to send message to, or "new" to create a new chat',
		schema: {
			oneOf: [
				{ type: 'string', format: 'uuid' },
				{ type: 'string', enum: ['new'] },
			],
		},
		example: 'new',
	})
	@ApiOkResponse({
		description: 'Message sent successfully',
		schema: { $ref: getSchemaPath(SendMessageResponseDTO) },
	})
	@ApiBadRequestResponse({
		description: 'Chat not found (when chatId is not "new")',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: { type: 'string', example: 'Chat not found' },
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiInternalServerErrorResponse({
		description: 'OpenAI API error or unexpected server error',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 500 },
				message: {
					type: 'string',
					examples: [
						'OpenAI API error message',
						'Unexpected error occurred',
					],
				},
				error: { type: 'string', example: 'Internal Server Error' },
			},
		},
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Post(':chatId/send-message')
	async sendMessage(
		@Param() param: ChatIdParamDTO,
		@Body() body: SendMessageBodyDTO,
		@Req() req: Request
	) {
		return await this.chatService.sendMessageNonApi(
			param.chatId,
			body.message,
			req.user!.id,
			body.selectedDocumentIds,
			body.helpful
		);
	}

	@ApiOperation({
		summary: 'Update message feedback',
		description: `
            Updates the helpful status of a specific message in a chat.
            - Allows users to mark messages as helpful or not helpful after they've been sent
            - Only the chat owner can update feedback for messages in their chats
            - Message must exist in the specified chat
        `,
	})
	@ApiParam({
		name: 'chatId',
		description: 'UUID of the chat',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'messageId',
		description: 'UUID of the message',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@ApiOkResponse({
		description: 'Feedback updated successfully',
		schema: { $ref: getSchemaPath(UpdateFeedbackResponseDTO) },
	})
	@ApiBadRequestResponse({
		description: 'Chat not found or message not found in chat',
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Patch(':chatId/messages/:messageId/feedback')
	async updateMessageFeedback(
		@Param('chatId') chatId: string,
		@Param('messageId') messageId: string,
		@Body() body: UpdateFeedbackBodyDTO,
		@Req() req: Request
	) {
		return await this.chatService.updateMessageFeedback(
			chatId,
			messageId,
			req.user!.id,
			body.helpful
		);
	}

	@ApiOperation({
		summary: 'Get signed URL for document download',
		description: `
            Generates a temporary signed URL to download a document from a chat.
            - URL expires after 1 day (86400 seconds)
            - Only the chat owner can generate signed URLs for documents in their chats
            - Document must exist in the specified chat
            - Use the signed URL to directly download the file from S3
        `,
	})
	@ApiParam({
		name: 'chatId',
		description: 'UUID of the chat',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'documentId',
		description: 'UUID of the document',
		example: '123e4567-e89b-12d3-a456-426614174001',
	})
	@ApiOkResponse({
		description: 'Signed URL generated successfully',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'Signed URL generated successfully',
				},
				data: {
					type: 'object',
					properties: {
						signedUrl: {
							type: 'string',
							example:
								'https://s3.amazonaws.com/bucket/key?signature=...',
						},
						fileName: {
							type: 'string',
							example: 'document.pdf',
						},
						expiresIn: {
							type: 'number',
							example: 86400,
							description: 'Time in seconds until URL expires',
						},
					},
				},
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Chat not found or document not found in chat',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: {
					type: 'string',
					example: 'Document not found in this chat',
				},
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiDefaultDocProtected()
	@UseGuards(JwtAuthGuard)
	@Get(':chatId/documents/:documentId/sign')
	async getSignedDocumentUrl(
		@Param('chatId') chatId: string,
		@Param('documentId') documentId: string,
		@Req() req: Request
	) {
		return await this.chatService.getSignedDocumentUrl(
			chatId,
			documentId,
			req.user!.id
		);
	}
}
