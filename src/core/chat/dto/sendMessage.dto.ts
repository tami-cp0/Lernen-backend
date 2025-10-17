import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, IsUUID } from "class-validator";

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
        description: 'Optional array of selected document IDs to reference for retreival',
        example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
        type: [String],
        required: false,
    })
    @IsString({ each: true, message: 'Each document ID must be a string' })
    @ArrayMaxSize(3, { message: 'You can provide at most 3 document IDs' })
    @IsArray({ message: 'selectedDocumentIds must be an array of IDs' })
    @IsNotEmpty({ each: true, message: 'selectedDocumentIds cannot contain empty values' })
    selectedDocumentIds?: string[];
}

export default SendMessageBodyDTO ;