import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GoogleVerifyBodyDTO {
    @ApiProperty({ example: '', description: 'Google OAuth2 code' })
    @IsString({ message: 'token must be a string' })
    @IsNotEmpty({ message: 'code is required and cannot be empty' })
    code: string;
}