import { ApiProperty } from "@nestjs/swagger";
import { Role } from "../user.types";
import { users } from "src/database/schema";
import { InferSelectModel } from "drizzle-orm";

class UserData implements InferSelectModel<typeof users> {
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

class ProfileData {
    @ApiProperty({ type: UserData, description: 'User profile information' })
    user: UserData;
}

export class ProfileResponseDTO {
    @ApiProperty({ example: 'User profile retrieved successfully', description: 'Success message' })
    message: string;

    @ApiProperty({ type: ProfileData, description: 'User profile data' })
    data: ProfileData;
}

class UsersProfileData {
    @ApiProperty({ type: UserData, isArray: true, description: 'List of user profiles' })
    users: UserData[];
}

export class GetAllUsersResponseDTO  {
    @ApiProperty({ example: 'All users fetched successfully', description: 'Success message' })
    message: string;

    @ApiProperty({ type: UsersProfileData, description: 'Users profile data' })
    data: UsersProfileData;
}