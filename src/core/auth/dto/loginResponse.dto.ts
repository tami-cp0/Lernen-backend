import { ApiProperty } from '@nestjs/swagger';
import { Role } from 'src/core/user/user.types';

class TokenData {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT refresh token' })
  refreshToken: string;
}

class UserData {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'User ID' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  email: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  lastName: string;

  @ApiProperty({ example: 'learner', enum: ['learner', 'teacher', 'admin'], description: 'User role' })
  role: Role;

  @ApiProperty({ example: true, description: 'Whether email notifications are enabled' })
  emailNotifications: boolean;

  @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'User creation timestamp' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-15T12:34:56.789Z', description: 'Last update timestamp' })
  updatedAt: Date;
}

export class LoginResponseDTO {
  @ApiProperty({ type: TokenData })
  data: TokenData;

  @ApiProperty({ type: UserData })
  user: UserData;

  @ApiProperty({ example: 'string', description: 'Response message' })
  message: string;
}
