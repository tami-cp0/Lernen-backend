import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Role } from "src/core/user/user.types";
import { roleEnum } from "src/database/schema";

export class RegisterLocalBodyDTO {
    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
        required: true,
    })
    @IsEmail({}, { message: 'email must be a valid email address' })
    @IsNotEmpty({ message: 'email is required and cannot be empty' })
    email: string;

    @ApiProperty({
        description: 'First name of the user',
        example: 'John',
        required: true,
    })
    @IsString({ message: 'firstName must be a string' })
    @IsNotEmpty({ message: 'firstName is required and cannot be empty' })
    firstName: string;

    @ApiProperty({
        description: 'Last name of the user',
        example: 'Doe',
        required: true,
    })
    @IsString({ message: 'lastName must be a string' })
    @IsNotEmpty({ message: 'lastName is required and cannot be empty' })
    lastName: string;

    @ApiProperty({
        description: 'Password for the account',
        example: 'StrongPassword123!',
        required: true,
    })
    @IsString({ message: 'password must be a string' })
    @IsNotEmpty({ message: 'password is required and cannot be empty' })
    password: string;

    @ApiProperty({
        description: 'Role of the user',
        example: 'learner',
        enum: roleEnum.enumValues,
        required: true,
    })
    @IsEnum(roleEnum.enumValues, { message: 'role must be one of the following: learner, teacher, admin' })
    @IsNotEmpty({ message: 'role is required and cannot be empty' })
    role: Role;
}
