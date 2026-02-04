import { ApiProperty } from '@nestjs/swagger';

export class GetDocumentsResponseDTO {
	@ApiProperty({
		description: 'Success message',
		example: 'Documents retrieved successfully',
	})
	message: string;

	@ApiProperty({
		description: 'Documents data',
		type: 'object',
		properties: {
			documents: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						chatId: { type: 'string', format: 'uuid' },
						userId: { type: 'string', format: 'uuid' },
						fileName: { type: 'string', example: 'document.pdf' },
						fileType: {
							type: 'string',
							example: 'application/pdf',
						},
						fileSize: { type: 'number', example: 1024000 },
						s3key: {
							type: 'string',
							example: 'user-docs/user-id/document.pdf',
						},
						createdAt: { type: 'string', format: 'date-time' },
					},
				},
			},
			count: {
				type: 'number',
				example: 3,
				description: 'Total number of documents',
			},
		},
	})
	data: {
		documents: Array<{
			id: string;
			chatId: string;
			userId: string;
			fileName: string;
			fileType: string;
			fileSize: number;
			s3key: string;
			createdAt: Date;
		}>;
		count: number;
	};
}
