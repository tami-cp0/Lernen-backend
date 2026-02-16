import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class RequestUploadUrlDTO {
	@ApiProperty({
		example: 'document.pdf',
		description: 'Name of the file to be uploaded',
	})
	@IsString()
	@IsNotEmpty()
	fileName: string;

	@ApiProperty({
		example: 'application/pdf',
		description: 'MIME type of the file',
	})
	@IsString()
	@IsNotEmpty()
	fileType: string;

	@ApiProperty({
		example: 2048000,
		description: 'Size of the file in bytes',
	})
	@IsNumber()
	@Min(1)
	fileSize: number;
}
