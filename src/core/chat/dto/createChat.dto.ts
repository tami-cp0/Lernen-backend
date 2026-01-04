import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateChatBodyDTO {
	@ApiProperty({
		description:
			'Optional UUID for the chat. If not provided, one will be generated automatically',
		example: '123e4567-e89b-12d3-a456-426614174000',
		required: false,
	})
	@IsOptional()
	@IsUUID()
	chatId?: string;
}

export class CreateChatResponseDTO {
	@ApiProperty({
		description: 'UUID of the newly created chat',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	chatId: string;

	@ApiProperty({
		description: 'Title of the chat',
		example: 'My Study Notes',
	})
	title: string;

	@ApiProperty({
		description: 'Chat creation timestamp',
		example: '2025-07-15T12:34:56.789Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Success message',
		example: 'Chat created successfully',
	})
	message: string;
}
