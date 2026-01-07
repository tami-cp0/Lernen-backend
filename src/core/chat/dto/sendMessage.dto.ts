import { ApiProperty } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
} from 'class-validator';

export class SendMessageBodyDTO {
	@ApiProperty({
		description: 'The message content',
		example: 'Hello, World!',
		type: String,
	})
	@IsString({ message: 'message must be a string' })
	@IsNotEmpty({ message: 'message is required and cannot be empty' })
	message: string;

	@ApiProperty({
		description:
			'Optional array of selected document IDs to reference for retreival',
		example: [
			'123e4567-e89b-12d3-a456-426614174000',
			'123e4567-e89b-12d3-a456-426614174001',
		],
		type: [String],
		required: false,
	})
	@IsString({ each: true, message: 'Each document ID must be a string' })
	@ArrayMaxSize(3, { message: 'You can provide at most 3 document IDs' })
	@IsArray({ message: 'selectedDocumentIds must be an array of IDs' })
	@IsOptional()
	selectedDocumentIds?: string[];

	@ApiProperty({
		description: 'Optional boolean indicating if the message was helpful',
		example: true,
		type: Boolean,
		required: false,
	})
	@IsOptional()
	@IsBoolean({ message: 'helpful must be a boolean value' })
	helpful?: boolean;

	@ApiProperty({
		description: 'Optional page number the user is currently viewing',
		example: 5,
		type: Number,
		required: false,
	})
	@IsOptional()
	pageNumber?: number;

	@ApiProperty({
		description:
			'Optional content of the page the user is currently viewing',
		example: 'This is the content of the page...',
		type: String,
		required: false,
	})
	@IsOptional()
	@IsString({ message: 'pageContent must be a string' })
	pageContent?: string;
}

export default SendMessageBodyDTO;
