import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
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
import { tokens, users } from 'src/database/schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
	constructor(
		private dbService: DatabaseService,
		private configService: ConfigService,
		private jwtService: JwtService,
		private emailService: EmailService
	) {}

	async sendMagicLink(
		email: string,
		provider: 'email' | 'google'
	) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
			with: { authAccounts: true }
		});

		if (provider === 'google') {
			return {
				message: 'Google login not implemented yet',
			};
		}

		if (user) {
			const payload = {
				sub: user.id,
				email: user.email,
				onboarded: user.onboarded,
				provider: user.authAccounts[0].provider,
				magicLink: true,
			};

			// temp token 
			const tempToken = this.jwtService.sign(payload, 
				{ expiresIn: '10m' }
			);

			await this.dbService.db.insert(tokens).values({
				userId: user.id,
				tokenHash: await bcrypt.hash(tempToken, 10),
				purpose: 'sign_in',
				consumed: false,
			})

			await this.emailService.sendEmail('sign_in', user.email, {
				tempToken
			});

			return {
				message: 'Magic link sent! Please check your email.',
			};
		} else {
			const [newUser] = await this.dbService.db
				.insert(users)
				.values({ email })
				.returning();
			
			await this.dbService.db.insert(authAccounts).values({
				userId: newUser.id,
				provider: 'email',
				providerAccountId: email,
			});

			const payload = {
				sub: newUser.id,
				email: newUser.email,
				onboarded: newUser.onboarded,
				provider: 'email',
				magicLink: true,
			};

			// temp token
			const tempToken = this.jwtService.sign(payload,
				{ expiresIn: '10m' }
			);

			await this.dbService.db.insert(tokens).values({
				userId: newUser.id,
				tokenHash: await bcrypt.hash(tempToken, 10),
				purpose: 'sign_in',
				consumed: false,
			})

			await this.emailService.sendEmail('sign_in', newUser.email, {
				tempToken
			});

			return {
				message: 'Magic link sent! Please check your email.',
			};
		}
	}

	async verifyMagicLink(token: string) {
		try {
			const payload = this.jwtService.verify<JwtPayload>(token);

			if (!payload || !payload.sub || !payload.magicLink) {
				throw new BadRequestException('Invalid link');
			}

			const user = await this.dbService.db.query.users.findFirst({
				where: eq(users.id, payload.sub),
				with: { authAccounts: true }
			});

			if (!user) {
				throw new BadRequestException('Invalid link');
			}

			if (!user.onboarded) {
				throw new ForbiddenException('User not onboarded');
			}

			const tokenRecord = await this.dbService.db.query.tokens.findFirst({
				where: and(
					eq(tokens.userId, user.id),
					eq(tokens.purpose, 'sign_in'),
				),
				orderBy: desc(tokens.createdAt),
			});

			if (!tokenRecord) {
				throw new BadRequestException('Invalid link');
			}

			if (tokenRecord.consumed) {
				throw new BadRequestException('Link has been used');
			}

			const isTokenValid = await bcrypt.compare(token, tokenRecord.tokenHash);
			if (!isTokenValid) {
				throw new BadRequestException('Invalid token');
			}

			// Mark the token as consumed
			await this.dbService.db
				.update(tokens)
				.set({ consumed: true, updatedAt: new Date() })
				.where(eq(tokens.id, tokenRecord.id));

			const newPayload: JwtPayload = {
				sub: user.id,
				email: user.email,
				onboarded: user.onboarded,
				provider: user.authAccounts[0].provider,
			}
			// Generate access and refresh tokens
			const accessToken = this.jwtService.sign(newPayload);

			const refreshToken = this.jwtService.sign(newPayload,
				{
					expiresIn:
						this.configService.get<RefreshJwtConfigType>('refreshJwt')!
							.expiration,
					secret:
						this.configService.get<RefreshJwtConfigType>('refreshJwt')!.secret,
				}
			);

			await this.dbService.db
				.update(authAccounts)
				.set({
					refreshToken,
					active: true,
					lastLogin: new Date(),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(authAccounts.userId, user.id),
						eq(authAccounts.provider, 'email')
					)
				);

			// const { authAccounts: _, ...safeUser } = user;
			
			return {
				message: 'Sign in successful',
				data: {
					accessToken,
					refreshToken,
				},
			};
		} catch (error) {
			if (error.name === 'TokenExpiredError') {
				throw new BadRequestException('Link has expired');
			}

			console.error(error);
			throw error;
		}
	}

	async onboard(data: { 
		email: string; firstName: string; lastName: string;
		educationLevel: string; preferences: string[]
	}) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, data.email),
		});

		if (!user) {
			throw new BadRequestException('User not found');
		}

		if (user.onboarded) {
			throw new BadRequestException('User already onboarded');
		}

		await this.dbService.db
			.update(users)
			.set({
				firstName: data.firstName,
				lastName: data.lastName,
				educationLevel: data.educationLevel,
				preferences: data.preferences,
				onboarded: true,
				updatedAt: new Date(),
			})
			.where(eq(users.id, user.id));

		// Hardcode provider as 'email' since only email sign up is allowed for now
		const newPayload: JwtPayload = {
			sub: user.id,
			email: user.email,
			onboarded: user.onboarded,
			provider: 'email',
		}

		// Generate access and refresh tokens
		const accessToken = this.jwtService.sign(newPayload);

		const refreshToken = this.jwtService.sign(newPayload,
			{
				expiresIn:
					this.configService.get<RefreshJwtConfigType>('refreshJwt')!
						.expiration,
				secret:
					this.configService.get<RefreshJwtConfigType>('refreshJwt')!.secret,
			}
		);

		await this.dbService.db
			.update(authAccounts)
			.set({
				refreshToken,
				active: true,
				lastLogin: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(authAccounts.userId, user.id),
					eq(authAccounts.provider, 'email')
				)
			);

		// const { authAccounts: _, ...safeUser } = user;
			
		return {
			message: 'User onboarding successful',
			data: {
				accessToken,
				refreshToken,
			},
		};
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
					eq(authAccounts.provider, 'email')
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
