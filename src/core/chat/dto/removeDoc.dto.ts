import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class RemoveDocBodyDTO {
    @ApiProperty({
        description: 'The unique identifier of the document to be removed',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsUUID('4', { message: 'documentId must be a valid UUID' })
    @IsNotEmpty({ message: 'documentId is required and cannot be empty' })
    documentId: string;
}

export default RemoveDocBodyDTO;