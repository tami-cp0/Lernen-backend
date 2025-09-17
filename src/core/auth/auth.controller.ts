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
import { SignInBodyDTO } from './dto/signIn.dto';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCreatedResponse,
	ApiExtraModels,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
	getSchemaPath,
} from '@nestjs/swagger';
import { ApiDefaultDocProtected, ApiDefaultDocPublic } from 'src/swagger';
import { RefreshJwtAuthGuard } from './guards/refresh/refreshJwt.guard';
import { VerifyBodyDTO } from './dto/verify.dto';
import { OnboardBodyDTO, OnboardQueryDTO } from './dto/onboard.dto';
import { GoogleVerifyBodyDTO } from './dto/googleSignIn.dto';
import { RefreshQueryDTO } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) {}

	@ApiOperation({
        summary: 'Request a magic-link by email',
        description: `
            Sends a magic link to the provided email. 
            If the user does not exist, an account is created and the link is sent.
            Note: Google sign-in uses the /auth/google/callback endpoint.
        `,
    })
	@ApiBody({ type: SignInBodyDTO })
	@ApiOkResponse({
		description: 'Magic link email sent',
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
				message: { type: 'string', example: 'Validation failed' },
				error: { type: 'string', example: 'Bad Request' },
			},
		},
	})
	@ApiDefaultDocPublic()
	@HttpCode(200)
	@Post('magic-link')
	async sendMagicLink(@Body() body: SignInBodyDTO) {
		return await this.authService.sendMagicLink(body.email, 'email');
	}

    @ApiOperation({
        summary: 'Verify temporary sign-in token',
        description: `
            Verifies a short-lived sign-in token and returns auth tokens if valid.
            Sources:
            - Email magic link (provider: email)
            - Google pre-sign-in flow (provider: google)
            Notes:
            - Token is single-use and is consumed on success.
            - Non-onboarded users will receive 403 and should complete onboarding (/auth/onboard).
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
    @ApiBadRequestResponse({
        description: 'Invalid, expired, or already-used token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Invalid token' }, // or 'Token has expired' / 'Temporary token has been used'
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiForbiddenResponse({
        description: 'User not onboarded',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: { type: 'string', example: 'User not onboarded' },
                error: { type: 'string', example: 'Forbidden' },
            },
        },
    })
	@ApiDefaultDocPublic()
	@HttpCode(200)
	@Post('/verify-token')
	async verifyToken(@Body() body: VerifyBodyDTO) {
		return await this.authService.verifyToken(body.token);
	}

	@ApiOperation({
        summary: 'Complete onboarding for a pending user',
        description: `
            Finalizes onboarding for a user created during sign-in.
            Uses the email in the body to locate the pending user.
            Requires ?provider=email|google in the query.
            Returns auth tokens and activates the account.
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
		description: 'Missing or invalid input or user not found etc',
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
	async onboard(@Body() body: OnboardBodyDTO, @Query() query: OnboardQueryDTO) {
		return await this.authService.onboard(body, query.provider);
	}

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
	async refresh(@Request() req: UserRequest, @Query() query: RefreshQueryDTO) {
		return await this.authService.refresh(req.user!, query.provider);
	}

	@ApiOperation({
        summary: 'Complete Google sign-in with authorization code',
        description: `
            Exchanges a Google authorization code for user info.
            - If the user is onboarded: returns access and refresh tokens.
            - If new or not onboarded: returns a temporary onboarding token (valid ~10 minutes).
            Note: redirect_uri must match the configured Google callback URL.
        `,
    })
	@ApiOkResponse({
        description: 'Google sign-in processed',
        content: {
            'application/json': {
                examples: {
                    onboarded: {
                        summary: 'Existing, onboarded user',
                        value: {
                            message: 'Sign in successful',
                            data: {
                                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                onboarded: true,
                            },
                        },
                    },
                    requiresOnboarding: {
                        summary: 'New or not-onboarded user',
                        value: {
                            message: 'Please complete onboarding.',
                            data: {
                                token: 'temp-sign-in-token',
                                provider: 'google',
                                email: 'user@example.com',
                                names: { firstName: 'Ada', lastName: 'Lovelace' },
                                onboarded: false,
                            },
                        },
                    },
                },
            },
        },
    })
	@ApiBadRequestResponse({
        description: 'Invalid code or Google API error',
        content: {
            'application/json': {
                examples: {
                    tokenExchangeFailed: {
                        summary: 'Token exchange failed',
                        value: { statusCode: 400, message: 'Google token exchange failed', error: 'Bad Request' },
                    },
                    userInfoFailed: {
                        summary: 'User info fetch failed',
                        value: { statusCode: 400, message: 'Failed to fetch user info from Google', error: 'Bad Request' },
                    },
                    emailNotVerified: {
                        summary: 'Email not verified',
                        value: { statusCode: 400, message: 'Google email not verified', error: 'Bad Request' },
                    },
                },
            },
        },
    })
    @ApiDefaultDocPublic()
    @HttpCode(200)
	@Post('google/callback')
	async googleSignIn(@Body() body: GoogleVerifyBodyDTO) {
		return await this.authService.googlePreSignIn(body.code);
	}
}
