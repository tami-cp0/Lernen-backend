import { Controller, Post, UseGuards, Request, Query, Body, HttpCode, Put, Req } from '@nestjs/common';
import { Request as UserRequest } from 'express';
import { LocalAuthGuard } from './guards/local/local.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt/jwt.guard';
import { LoginBodyDTO, LoginQueryDTO } from './dto/login.dto';
import { RegisterLocalBodyDTO } from './dto/register.dto';
import VerifyEmailBodyDTO from './dto/verifyEmail.dto';
import ResendVerificationEmailBodyDTO from './dto/resendVerificationEmail.dto';
import { ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiDefaultDocProtected, ApiDefaultDocPublic } from 'src/swagger';
import { LoginResponseDTO } from './dto/loginResponse.dto';

@ApiExtraModels(LoginResponseDTO)
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
    ) {}

    @ApiOperation({
        summary: 'Login a user',
        description: `
            Authenticates a user using email/password (provider = "email") or OAuth (provider = "google").
            - Returns access & refresh tokens and the user object for email logins.
            - Google login: not implemented yet.
        `,
    })
    @ApiBody({ type: LoginBodyDTO })
    @ApiCreatedResponse({
        description: 'Login successful',
        schema: { $ref: getSchemaPath(LoginResponseDTO) },
    })
    @ApiBadRequestResponse({
        description: 'Missing or invalid input',
        schema: {
            type: 'object',
            properties: {
            statusCode: { type: 'number', example: 400 },
            message: { type: 'string', example: 'Unsupported provider' },
            error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: 'Invalid credentials',
        schema: {
            type: 'object',
            properties: {
            message: { type: 'string', example: 'Invalid email or password' },
            error: { type: 'string', example: 'Unauthorized' },
            statusCode: { type: 'number', example: 401 },
            },
        },
    })
    @ApiDefaultDocPublic()
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@Request() req: UserRequest, @Query() query: LoginQueryDTO) {
        return await this.authService.login(req.user!, query.provider);
    }

    
    @ApiOperation({
        summary: 'Logout user',
        description: `
            Invalidates the current user's refresh token so it can no longer be used to obtain new access tokens.
            Requires a valid Bearer token.
        `,
    })
    @ApiNoContentResponse({ description: 'Logout successful' })
    @ApiDefaultDocProtected()
    @UseGuards(JwtAuthGuard)
    @HttpCode(204)
    @Post('logout')
    async logout(@Request() req: UserRequest) {
        await this.authService.logout(req.user!.id);
    }


    @ApiOperation({
        summary: 'Register a new local account',
        description:
        'Creates a new user account using email, first name, last name, and password. ' +
        'Sends a verification OTP to the provided email address. ' +
        'Fails if the email is already registered.',
    })
    @ApiCreatedResponse({
        description:
        'User registered successfully. A verification OTP has been sent to the provided email.',
        schema: {
        example: {
            message: 'An email for OTP verification has been sent to your email.',
        },
        },
    })
    @ApiBadRequestResponse({
        description: 'Bad Request — invalid input or email already registered.',
        schema: {
        example: {
            statusCode: 400,
            message: 'User with this email already exists',
            error: 'Bad Request',
        },
        },
    })
    @ApiDefaultDocPublic()
    @Post('register')
    async register(@Body() body: RegisterLocalBodyDTO) {
        return await this.authService.registerLocal(
            body.email, body.firstName, body.lastName,
            body.password, body.role
        );
    }

    // use loginResponseDTO since successful verification is the same as loggin in.
    @ApiOperation({
    summary: 'Verify user email',
        description:
            'Verifies a user\'s email address using a one-time password (OTP) sent to the email. ' +
            'If the OTP is valid, the email authentication account is marked as verified and JWT tokens are returned.',
    })
    @ApiOkResponse({
        description: 'Email verified successfully. Returns access and refresh tokens.',
        schema: { $ref: getSchemaPath(LoginResponseDTO) }
    })
    @ApiBadRequestResponse({
        description: 'This OTP has already been used or expired or invalid',
        schema: {
        example: {
            statusCode: 400,
            message: 'Invalid OTP',
            error: 'Bad Request',
        },
        },
    })
    @ApiDefaultDocPublic()
    @HttpCode(200)
    @Put('verify-email')
    async verifyEmail(@Body() body: VerifyEmailBodyDTO) {
        return await this.authService.verifyEmail(body.email, body.otp);
    }

    @ApiOperation({
        summary: 'Resend Email Verification OTP',
        description:
            'Sends a new email verification OTP to the user’s registered email address. This is used when the previous OTP has expired or was not received.',
    })
    @ApiOkResponse({
        description: 'OTP email successfully resent',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'An email for OTP verification has been sent to your email.',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Bad Request — User not found or invalid input.',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'User not found or invalid input' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiDefaultDocPublic()
    @HttpCode(200)
    @Post('resend-verification-email')
    async resendVerificationEmail(@Body() body: ResendVerificationEmailBodyDTO) {
        return await this.authService.resendVerificationEmail(body.email);
    }

    // use loginResponseDTO since successful verification is the same as loggin in.
    @ApiOperation({
        summary: "Refreshes the user's auth tokens",
        description: `
            Refreshes both the refresh and access tokens
        `,
    })
    @ApiOkResponse({
        description: 'Tokens refreshed successfully',
        schema: { $ref: getSchemaPath(LoginResponseDTO) },
    })
    @ApiDefaultDocProtected()
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Post('refresh')
    async refresh(@Request() req: UserRequest ) {
        return await this.authService.refresh(req.user!)
    }
}
