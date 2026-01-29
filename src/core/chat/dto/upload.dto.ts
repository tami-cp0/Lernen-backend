import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadDocBodyDTO {
	@ApiProperty({
		example: 'What is a bot?',
		description: 'User query',
	})
	@IsString({ message: 'message must be a string' })
	@IsOptional()
	message: string;
}

class SuccessfulUpload {
	@ApiProperty({
		example: 'doc-123e4567-e89b-12d3-a456-426614174000',
		description: 'Document ID',
	})
	id: string;

	@ApiProperty({ example: 'document.pdf', description: 'Original filename' })
	name: string;
}

class FailedUpload {
	@ApiProperty({
		example: 'failed-document.pdf',
		description: 'Original filename that failed to upload',
	})
	name: string;

	@ApiProperty({
		example: 'No remaining upload slots',
		description: 'Reason for upload failure',
		required: false,
	})
	reason?: string;
}

export class UploadDocumentResponseDTO {
	@ApiProperty({
		example: 'All files uploaded successfully',
		description: 'Summary message about upload result',
	})
	message: string;

	@ApiProperty({
		example: 2,
		description:
			'Number of remaining upload slots for this chat (max 5 total)',
	})
	remainingSlots: number;

	@ApiProperty({
		example: '123e4567-e89b-12d3-a456-426614174000',
		description: 'ID of the chat (newly created or existing)',
	})
	chatId: string;

	@ApiProperty({
		type: [SuccessfulUpload],
		description: 'Successfully uploaded documents',
	})
	successfulUploads: SuccessfulUpload[];

	@ApiProperty({
		type: [FailedUpload],
		description: 'Failed upload attempts with reasons',
	})
	failedUploads: FailedUpload[];
}
