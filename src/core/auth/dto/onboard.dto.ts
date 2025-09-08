import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class OnboardBodyDTO {
    @ApiProperty({ example: 'user@example.com', description: 'User email address' })
    @IsEmail({}, { message: 'email must be a valid email address' })
    @IsNotEmpty({ message: 'email is required and cannot be empty' })
    email: string;

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
}