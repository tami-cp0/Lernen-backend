import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import { authAccounts } from 'src/database/schema/authAccounts';
import {
	JwtPayload,
	UserWithAuthAccounts,
} from './auth.types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshJwtConfigType } from 'src/config/config.types';
import { EmailService } from 'src/common/services/email/email.service';

@Injectable()
export class AuthService {
	constructor(
		private dbService: DatabaseService,
		private configService: ConfigService,
		private jwtService: JwtService,
		private emailService: EmailService
	) {}

	async login(
		user: UserWithAuthAccounts,
		provider: 'email' | 'google'
	) {
		if (provider === 'email') {
			const payload: JwtPayload = {
				sub: user.id,
				email: user.email,
				onboarded: user.onboarded,
				provider: user.authAccounts[0].provider,
			};

			const refreshToken = this.jwtService.sign(payload, {
				expiresIn:
					this.configService.get<RefreshJwtConfigType>('refreshJwt')!.expiration,
				secret:
					this.configService.get<RefreshJwtConfigType>('refreshJwt')!.secret,
			});

			await this.dbService.db
				.update(authAccounts)
				.set({ refreshToken, active: true })
				.where(
					and(
						eq(authAccounts.userId, user.id),
						eq(authAccounts.provider, 'magic_link')
					)
				);

			const { authAccounts: _remove, ...safeUser } = user;

			return {
				data: {
					accessToken: this.jwtService.sign(payload),
					refreshToken,
				},
				user: safeUser,
				message: 'Login successful',
			};
		} else if (provider === 'google') {
			return {
				message: 'Google login not implemented yet',
				data: null,
				user: null,
			};
		}

		throw new BadRequestException('Unsupported provider');
	}

	async logout(userId: string): Promise<void> {
		await this.dbService.db
			.update(authAccounts)
			.set({
				refreshToken: null,
				active: false,
			})
			.where(eq(authAccounts.userId, userId));
	}

	async refresh(user: UserWithAuthAccounts) {
		// refresh token, send back access and refresh
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			onboarded: user.onboarded,
			provider: user.authAccounts[0].provider,
		};

		const accessToken = this.jwtService.sign(payload);
		const refreshToken = this.jwtService.sign(payload, {
			expiresIn:
				this.configService.get<RefreshJwtConfigType>('refreshJwt')!.expiration,
			secret:
				this.configService.get<RefreshJwtConfigType>('refreshJwt')!.secret,
		});

		await this.dbService.db
			.update(authAccounts)
			.set({ refreshToken, updatedAt: new Date() })
			.where(
				and(
					eq(authAccounts.userId, user.id),
					eq(authAccounts.provider, 'magic_link')
				)
			);

		return {
			message: 'Tokens refreshed successfully',
			data: {
				accessToken,
				refreshToken,
			},
			user,
		};
	}
}
