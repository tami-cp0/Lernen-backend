import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthAccount } from '../auth.types';

export class LoginQueryDTO {
  @ApiProperty({ example: 'email', enum: ['email','google'], description: 'Auth provider' })
  @IsIn(['email', 'google'], { message: 'provider must be either email or google' })
  @IsString({ message: 'provider must be a string' })
  @IsNotEmpty({ message: 'provider is required and cannot be empty' })
  provider: AuthAccount['provider'];
}

export class LoginBodyDTO {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required and cannot be empty' })
  email: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'User password' })
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password is required and cannot be empty' })
  password: string;
}
