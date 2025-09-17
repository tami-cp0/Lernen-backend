import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import { authAccounts } from 'src/database/schema/authAccounts';
import {
	JwtPayload,
	SignInJwtPayload,
	UserWithAuthAccounts,
} from './auth.types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfigType, GoogleConfigType, RefreshJwtConfigType } from 'src/config/config.types';
import { EmailService } from 'src/common/services/email/email.service';
import { tokens, users } from 'src/database/schema';
import * as bcrypt from 'bcrypt';

interface GoogleUserInfo {
  id: string;              // Google user ID (unique identifier)
  email: string;           // User's email address
  verified_email: boolean; // Whether email is verified
  name: string;            // Full name
  given_name: string;      // First name
  family_name: string;     // Last name  
  picture: string;         // Profile picture URL
  locale: string;          // Language locale (e.g., "en")
}

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
		provider: 'email'
	) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
			with: { authAccounts: true }
		});

		const existingProvider = user?.authAccounts.find(acc => acc.provider === provider);


		if (user) {
			await this.dbService.db
				.update(tokens)
				.set({ consumed: true, updatedAt: new Date() })
				.where(and(eq(tokens.userId, user.id), eq(tokens.purpose, 'sign_in'), eq(tokens.consumed, false))); // add
			
			// Link email account if not already linked
			if (!existingProvider) {
				await this.dbService.db.insert(authAccounts).values({
					userId: user.id,
					provider: provider,
					providerAccountId: email,
				});
			}

			const payload: SignInJwtPayload = {
				sub: user.id,
				email: user.email,
				onboarded: user.onboarded,
				provider,
				type: 'signIn',
			};

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
				tempToken, id: user.id
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

			const payload: SignInJwtPayload = {
				sub: newUser.id,
				email: newUser.email,
				onboarded: newUser.onboarded,
				provider: 'email',
				type: 'signIn',
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
				tempToken, id: newUser.id
			});

			return {
				message: 'Magic link sent! Please check your email.',
			};
		}
	}

	async verifyToken(token: string) {
		try {
			const payload = this.jwtService.verify<SignInJwtPayload>(token);

			if (!payload || !payload.sub) {
				throw new BadRequestException('Invalid token');
			}

			const user = await this.dbService.db.query.users.findFirst({
				where: eq(users.id, payload.sub),
				with: { authAccounts: true }
			});

			if (!user) {
				throw new BadRequestException('Invalid token');
			}

			 // Find an unconsumed token that matches the provided token
            const tokenRecords = await this.dbService.db.query.tokens.findMany({
                where: and(
                    eq(tokens.userId, user.id),
                    eq(tokens.purpose, 'sign_in'),
                    eq(tokens.consumed, false),
                ),
                orderBy: desc(tokens.createdAt),
            });

			// Compare the provided token with stored hashed tokens
            let tokenRecord: typeof tokens.$inferSelect | null = null;
            for (const rec of tokenRecords) {
                if (await bcrypt.compare(token, rec.tokenHash)) {
                    tokenRecord = rec;
                    break;
                }
            }

			if (!tokenRecord) {
				throw new BadRequestException('Invalid token');
			}

			// Mark the token as consumed
			await this.dbService.db
				.update(tokens)
				.set({ consumed: true, updatedAt: new Date() })
				.where(eq(tokens.id, tokenRecord.id));

			if (!user.onboarded) {
				return {
					message: 'User not onboarded',
					data: {
						onboarded: false, id: user.id, provider: payload.provider,
						names: { firstName: user.firstName, lastName: user.lastName }
					},
				};
			}

			const authPayload: JwtPayload = {
				sub: user.id,
				email: user.email,
				provider: payload.provider,
				type: 'authorization',
			}
			// Generate access and refresh tokens
			const accessToken = this.jwtService.sign(authPayload);

			const refreshToken = this.jwtService.sign(authPayload,
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
						eq(authAccounts.provider, payload.provider)
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
				throw new BadRequestException('Token has expired');
			}

			console.error(error);
			throw error;
		}
	}

	async onboard(data: { 
		id: string; firstName: string; lastName: string;
		educationLevel: string; preferences: string[]
	}, provider: 'email' | 'google'
	) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.id, data.id),
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

		const newPayload: JwtPayload = {
			sub: user.id,
			email: user.email,
			provider,
			type: 'authorization',
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
					eq(authAccounts.provider, provider)
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

	async refresh(user: UserWithAuthAccounts, provider) {
		if (!user.authAccounts?.some(a => a.provider === provider)) {
			throw new BadRequestException('Provider not linked');
		}

		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			provider: provider,
			type: 'authorization',
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
					eq(authAccounts.provider, provider)
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

	async googlePreSignIn(code: string) {
		try {
			// Exchange code for tokens
			const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					code: code,
					client_id: this.configService.get<GoogleConfigType>('google')!.clientId!,
					client_secret: this.configService.get<GoogleConfigType>('google')!.clientSecret!,
					redirect_uri: this.configService.get<GoogleConfigType>('google')!.redirectUrl!,
					grant_type: 'authorization_code'
				})
			});

			if (!tokenResponse.ok) {
				const error = await tokenResponse.json();
				console.log(error);
				throw new Error(`Token exchange failed`);
			}
			
			const googleTokens: { access_token: string; id_token?: string; refresh_token?: string } =
            await tokenResponse.json();
			
			// Get user info
			const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: {
					Authorization: `Bearer ${googleTokens.access_token}`
				}
			});
			
			if (!userResponse.ok) {
				console.log(await userResponse.json());
				throw new Error('Failed to fetch user info from Google');
			}

			const userInfo: GoogleUserInfo = await userResponse.json();

			if (!userInfo.verified_email) {
				throw new BadRequestException('Google email not verified');
			}	

			// Check if user exists
			let user = await this.dbService.db.query.users.findFirst({
				where: eq(users.email, userInfo.email),
				with: { authAccounts: true }
			});

			if (user) {
				if (!user.authAccounts.some(acc => acc.provider === 'google')) {
					// Link Google account if not already linked
					await this.dbService.db.insert(authAccounts).values({
						userId: user.id,
						provider: 'google',
						providerAccountId: userInfo.id,
					});
				}

				if (user.onboarded) {
					// Generate access and refresh tokens
					const payload: JwtPayload = {
						sub: user.id,
						email: user.email,
						provider: 'google',
						type: 'authorization',
					}
					const accessToken = this.jwtService.sign(payload);
					const refreshToken = this.jwtService.sign(payload, {
						expiresIn:
							this.configService.get<RefreshJwtConfigType>('refreshJwt')!
								.expiration,
						secret:
							this.configService.get<RefreshJwtConfigType>('refreshJwt')!.secret,
					});
					await this.dbService.db
						.update(authAccounts)
						.set({ refreshToken, active: true, lastLogin: new Date(), updatedAt: new Date() })
						.where(
							and(
								eq(authAccounts.userId, user.id),
								eq(authAccounts.provider, 'google')
							)
						);
					return {
						data: { accessToken, refreshToken, onboarded: true },
						message: 'Sign in successful',
					};
				}

				await this.dbService.db
					.update(tokens)
					.set({ consumed: true, updatedAt: new Date() })
					.where(and(eq(tokens.userId, user.id), eq(tokens.purpose, 'sign_in'), eq(tokens.consumed, false))); // add

				const tempPayload: SignInJwtPayload = {
                    sub: user.id,
                    email: user.email,
                    onboarded: user.onboarded,
                    provider: 'google',
                    type: 'signIn',
                };
                const tempToken = this.jwtService.sign(tempPayload, { expiresIn: '10m' });

                await this.dbService.db.insert(tokens).values({
                    userId: user.id,
                    tokenHash: await bcrypt.hash(tempToken, 10),
                    purpose: 'sign_in',
                    consumed: false,
                });

                return {
                    data: {
                        token: tempToken,
                        provider: 'google',
                        id: user.id,
                        names: { firstName: user.firstName, lastName: user.lastName },
                        onboarded: false,
                    },
                    message: 'Please complete onboarding.',
                };
			} else {
				// Create new user
				const [newUser] = await this.dbService.db
					.insert(users)
					.values({ 
						email: userInfo.email,
						firstName: userInfo.given_name,
						lastName: userInfo.family_name,
					})
					.returning();
				
				await this.dbService.db.insert(authAccounts).values({
					userId: newUser.id,
					provider: 'google',
					providerAccountId: userInfo.id,
				});

				const payload: SignInJwtPayload = {
					sub: newUser.id,
					email: newUser.email,
					onboarded: newUser.onboarded,
					provider: 'google',
					type: 'signIn',
				};

				const tempToken = this.jwtService.sign(payload,
					{ expiresIn: '10m' }
				);

				await this.dbService.db.insert(tokens).values({
					userId: newUser.id,
					tokenHash: await bcrypt.hash(tempToken, 10),
					purpose: 'sign_in',
					consumed: false,
				})

				return {
					data: {
						token: tempToken,
						provider: 'google',
						id: newUser.id,
					},
					message: 'User created. Please complete onboarding.'
				}
			}
		} catch (error) {
			console.error('Token exchange error:', error);
			throw new BadRequestException(error?.message || 'Google sign-in failed');
		}
	}
}
