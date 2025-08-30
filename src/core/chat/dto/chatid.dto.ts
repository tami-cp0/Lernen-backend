import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class ChatIdParamDTO {
    @ApiProperty({
        description: 'The ID of the chat session',
        example: '550e8400-e29b-41d4-a716-446655440000 or new',
    })
    @IsString({ message: 'chatId must be a string' })
    @IsNotEmpty({ message: 'chatId is required and cannot be empty' })
    chatId: string | 'new';
}

export default ChatIdParamDTO;