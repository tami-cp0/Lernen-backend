import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { AuthAccount } from "../auth.types";

export class RefreshQueryDTO {
  @ApiProperty({ example: 'email', enum: ['email','google'], description: 'Auth provider' })
  @IsIn(['email', 'google'], { message: 'provider must be either email or google' })
  @IsString({ message: 'provider must be a string' })
  @IsNotEmpty({ message: 'provider is required and cannot be empty' })
  provider: AuthAccount['provider'];
}