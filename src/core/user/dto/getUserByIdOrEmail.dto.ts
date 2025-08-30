import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateEmailDTO {
    @ApiProperty({
        description: 'The identifier to find the user (ID or email)',
        example: 'johndoe@gmail.com'
    })
    @IsString({ message: 'identifier must be a string' })
    @IsNotEmpty({ message: 'identifier is required' })
    identifier: string;
}
