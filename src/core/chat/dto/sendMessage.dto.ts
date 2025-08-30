import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class SendMessageBodyDTO {
    // @ArrayMaxSize(3, { message: 'You can provide at most 3 document IDs' })
    // @IsArray({ message: 'documentIds must be an array of IDs' })
    // @IsUUID('4', { each: true, message: 'Each document ID must be a valid UUID' })
    // @IsNotEmpty({ each: true, message: 'documentIds cannot be empty' })
    // documentIds: string[];

    @ApiProperty({
        description: 'The message content',
        example: 'Hello, World!',
        type: String,
    })
    @IsString({ message: 'message must be a string' })
    @IsNotEmpty({ message: 'message is required and cannot be empty' })
    message: string;
}

export default SendMessageBodyDTO ;