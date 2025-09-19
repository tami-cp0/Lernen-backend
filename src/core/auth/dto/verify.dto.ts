import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class VerifyBodyDTO {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Verification token' })
  @IsString({ message: 'token must be a string' })
  @IsNotEmpty({ message: 'token is required and cannot be empty' })
  token: string;
}