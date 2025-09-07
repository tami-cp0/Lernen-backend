import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

class ForgotPasswordBodyDTO {
  @ApiProperty({
    description: 'The email address to verify.',
    example: 'johndoe@example.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required and cannot be empty' })
  email: string;
}

export default ForgotPasswordBodyDTO;