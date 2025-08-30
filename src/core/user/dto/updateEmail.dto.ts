import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class UpdateEmailDTO {
    @ApiProperty({
        description: 'The new email address to update',
        example: 'johndoe@gmail.com',
        required: true,
        type: String,
        format: 'email',
    })
    @IsEmail({}, { message: 'email must be a valid email address' })
    @IsNotEmpty( { message: 'email is required'} )
    email: string;
}


export class VerifyEmailUpdateDTO {
    @ApiProperty({
        description: 'The new email address to update',
        example: 'johndoe@gmail.com',
        required: true,
        type: String,
        format: 'email',
    })
    @IsEmail({}, { message: 'newEmail must be a valid email address' })
    @IsNotEmpty( { message: 'newEmail is required'} )
    newEmail: string;

    @ApiProperty({
        description: 'The OTP code sent to the new email address',
        example: '123456',
        required: true,
        type: String,
    })
    @IsString({ message: 'otp must be a string' })
    @IsNotEmpty({ message: 'otp is required' })
    otp: string;
}