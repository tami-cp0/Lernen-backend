import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesQueryDTO {
	@ApiProperty({
		description: 'Page number (1-indexed)',
		example: 1,
		minimum: 1,
		required: false,
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiProperty({
		description: 'Number of messages per page',
		example: 20,
		minimum: 1,
		maximum: 100,
		required: false,
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;
}

export class GetMessagesResponseDTO {
	@ApiProperty({
		description: 'Success message',
		example: 'Messages retrieved successfully',
	})
	message: string;

	@ApiProperty({
		description: 'Paginated messages data',
		type: 'object',
		properties: {
			messages: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						chatId: { type: 'string', format: 'uuid' },
						turn: {
							type: 'object',
							properties: {
								user: { type: 'string' },
								assistant: { type: 'string' },
							},
						},
						helpful: { type: 'boolean', nullable: true },
						totalTokens: { type: 'number' },
						createdAt: { type: 'string', format: 'date-time' },
					},
				},
			},
			pagination: {
				type: 'object',
				properties: {
					page: { type: 'number', example: 1 },
					limit: { type: 'number', example: 20 },
					totalMessages: { type: 'number', example: 45 },
					totalPages: { type: 'number', example: 3 },
					hasNextPage: { type: 'boolean', example: true },
					hasPreviousPage: { type: 'boolean', example: false },
				},
			},
		},
	})
	data: {
		messages: Array<{
			id: string;
			chatId: string;
			turn: {
				user: string;
				assistant: string;
			};
			helpful: boolean | null;
			totalTokens: number;
			createdAt: Date;
		}>;
		pagination: {
			page: number;
			limit: number;
			totalMessages: number;
			totalPages: number;
			hasNextPage: boolean;
			hasPreviousPage: boolean;
		};
	};
}
