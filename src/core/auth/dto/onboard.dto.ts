import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { AuthAccount } from "../auth.types";

export class OnboardBodyDTO {
    
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'User ID' })
    @IsString({ message: 'id must be a string' })
    @IsNotEmpty({ message: 'id is required and cannot be empty' })
    id: string;

    @ApiProperty({ example: 'John', description: 'First name', required: false })
    @IsString({ message: 'firstName must be a string' })
    @IsNotEmpty({ message: 'firstName cannot be empty' })
    firstName: string;

    @ApiProperty({ example: 'Doe', description: 'Last name', required: false })
    @IsString({ message: 'lastName must be a string' })
    @IsNotEmpty({ message: 'lastName cannot be empty' })
    lastName: string;

    @ApiProperty({ example: 'Bachelor\'s Degree', description: 'Education level', required: false })
    @IsString({ message: 'educationLevel must be a string' })
    @IsNotEmpty({ message: 'educationLevel cannot be empty' })
    educationLevel: string;

    @ApiProperty({ example: ['No Idea'], description: 'User preferences', required: false, type: [String] })
    @IsString({ each: true, message: 'Each preference must be a string' })
    @IsNotEmpty({ message: 'preferences cannot contain empty strings' })
    preferences: string[];

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Verification token' })
    @IsString({ message: 'token must be a string' })
    @IsNotEmpty({ message: 'token is required and cannot be empty' })
    token: string;
}

export class OnboardQueryDTO {
  @ApiProperty({ example: 'email', enum: ['email','google'], description: 'Auth provider' })
  @IsIn(['email', 'google'], { message: 'provider must be either email or google' })
  @IsString({ message: 'provider must be a string' })
  @IsNotEmpty({ message: 'provider is required and cannot be empty' })
  provider: AuthAccount['provider'];
}