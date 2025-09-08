import {
	Controller,
	Post,
	UseGuards,
	Request,
	Query,
	HttpCode,
	Body,
	Put,
} from '@nestjs/common';
import { Request as UserRequest } from 'express';
import { AuthService } from './auth.service';
import { SignInBodyDTO, SignInQueryDTO } from './dto/signIn.dto';
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
import { VerifyBodyDTO } from './dto/verify.dto';
import { OnboardBodyDTO } from './dto/onboard.dto';

@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) {}

	@ApiOperation({
		summary: 'Sign in or Sign up a user',
		description: `
            Authenticates or creates a user using a magic link sent to their email.
			- Email login: sends a magic link to the provided email address.
            - Google login: not implemented yet.
        `,
	})
	@ApiBody({ type: SignInBodyDTO })
	@ApiOkResponse({
		description: 'successful',
		schema: {
			example: {
			message: 'Magic link sent! Please check your email',
			},
		},
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
	@ApiDefaultDocPublic()
	@HttpCode(200)
	@Post('magic-link')
	async sendMagicLink(@Query() query: SignInQueryDTO, @Body() body: SignInBodyDTO) {
		return await this.authService.sendMagicLink(body.email, query.provider);
	}

	@ApiOperation({
		summary: 'Verify magic link token',
		description: `
			Verifies the magic link token sent to the user's email.
			If valid, signs in the user and returns auth tokens.
		`,
	})
	@ApiOkResponse({
		description: 'Sign in successful',
		schema: {
			type: 'object',
			properties: {
			message: { type: 'string', example: 'Sign in successful' },
			data: {
				type: 'object',
				properties: {
					accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
					refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
				},
			},
			},
		},
	})
	@ApiUnauthorizedResponse({
		description: 'Invalid or expired token',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 401 },
				message: { type: 'string', example: 'Invalid or expired token' },
				error: { type: 'string', example: 'Unauthorized' },
			},
		},
	})
	@ApiDefaultDocPublic()
	@HttpCode(200)
	@Post('/magic-link/verify')
	async verify(@Body() body: VerifyBodyDTO) {
		return await this.authService.verifyMagicLink(body.token);
	}

	@ApiOperation({
		summary: "Onboards a new user by collecting additional information",
		description: `
			Completes the onboarding process for a newly registered user
			by collecting additional required information.
		`,
	})
	@ApiOkResponse({
		description: 'User onboarding successful',
		schema: {
			type: 'object',
			properties: {
			message: { type: 'string', example: 'User onboarding successful' },
			data: {
				type: 'object',
				properties: {
					accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
					refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
				},
			},
			},
		},
	})
	@ApiBadRequestResponse({
		description: 'Missing or invalid input',
		schema: {
			type: 'object',
			properties: {
				statusCode: { type: 'number', example: 400 },
				message: { type: 'string', example: 'Invalid input data' },
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiDefaultDocPublic()
	@HttpCode(200)
	@Put('onboard')
	async onboard(@Body() body: OnboardBodyDTO) {
		return await this.authService.onboard(body);
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
