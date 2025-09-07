import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

class ResetPasswordBodyDTO {
  @ApiProperty({
    description: 'The reset token from the email link.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'token must be a string' })
  @IsNotEmpty({ message: 'token is required and cannot be empty' })
  token: string;

  @ApiProperty({
    description: 'The new password for the user.',
    example: 'NewSecurePassword123!',
  })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  }, { message: 'newPassword should be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and special characters.' })
  @IsNotEmpty({ message: 'newPassword is required and cannot be empty' })
  newPassword: string;

  @ApiProperty({
    description: 'Confirmation of the new password.',
    example: 'NewSecurePassword123!',
  })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  }, { message: 'confirmPassword should be at least 8 characters long and include uppercase letters, lowercase letters, numbers, and special characters.' })
  @IsNotEmpty({ message: 'confirmPassword is required and cannot be empty' })
  confirmPassword: string;
}

export default ResetPasswordBodyDTO;