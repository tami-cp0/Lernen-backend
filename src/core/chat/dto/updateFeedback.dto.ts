import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateFeedbackBodyDTO {
	@ApiProperty({
		description: 'Whether the message was helpful',
		example: true,
	})
	@IsBoolean({ message: 'helpful must be a boolean value' })
	helpful: boolean;
}

export class UpdateFeedbackResponseDTO {
	@ApiProperty({
		description: 'Success message',
		example: 'Feedback updated successfully',
	})
	message: string;

	@ApiProperty({
		description: 'Updated message ID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	messageId: string;

	@ApiProperty({
		description: 'Updated helpful status',
		example: true,
	})
	helpful: boolean;
}
