import {
	Controller,
	Post,
	UseGuards,
	Request,
	Query,
	HttpCode,
} from '@nestjs/common';
import { Request as UserRequest } from 'express';
import { AuthService } from './auth.service';
import { LoginBodyDTO, LoginQueryDTO } from './dto/login.dto';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCreatedResponse,
	ApiExtraModels,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
	getSchemaPath,
} from '@nestjs/swagger';
import { ApiDefaultDocProtected, ApiDefaultDocPublic } from 'src/swagger';
import { RefreshJwtAuthGuard } from './guards/refresh/refreshJwt.guard';

@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) {}

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
				message: {
					type: 'string',
					example: 'Invalid email or password',
				},
				error: { type: 'string', example: 'Unauthorized' },
				statusCode: { type: 'number', example: 401 },
			},
		},
	})
	@ApiDefaultDocPublic()
	@Post('login')
	async login(@Request() req: UserRequest, @Query() query: LoginQueryDTO) {
		return await this.authService.login(req.user!, 'google');
	}

	// use loginResponseDTO since successful verification is the same as loggin in.
	@ApiOperation({
		summary: "Refreshes the user's auth tokens",
		description: `
            Refreshes both the refresh and access tokens
            using a valid refresh token provided in the Authorization header.
        `,
	})
	@ApiOkResponse({
		description: 'Tokens refreshed successfully',
	})
	@ApiDefaultDocProtected()
	@UseGuards(RefreshJwtAuthGuard)
	@HttpCode(200)
	@Post('refresh')
	async refresh(@Request() req: UserRequest) {
		return await this.authService.refresh(req.user!);
	}
}
