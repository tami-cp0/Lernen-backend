import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class VerifyBodyDTO {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsNotEmpty({ message: 'token is required and cannot be empty' })
  token: string;
}