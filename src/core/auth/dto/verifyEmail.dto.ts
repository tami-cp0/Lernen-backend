import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

class VerifyEmailBodyDTO {
  @ApiProperty({
    description: 'The email address to verify.',
    example: 'johndoe@example.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required and cannot be empty' })
  email: string;

  @ApiProperty({
    description: 'The one-time password (OTP) sent to the user\'s email for verification.',
    example: '348291',
  })
  @IsString({ message: 'otp must be a string' })
  @IsNotEmpty({ message: 'otp is required and cannot be empty' })
  otp: string;
}

export default VerifyEmailBodyDTO;