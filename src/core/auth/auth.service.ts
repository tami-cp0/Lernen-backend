import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { and, desc, eq, gt } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import { otps, users } from 'src/database/schema';
import { authAccounts } from 'src/database/schema/authAccounts';
import {
	JwtPayload,
	UserWithAuthAccounts,
	UserWithAuthAccountsWithoutPassword,
} from './auth.types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordJwtConfigType, JwtConfigType, RefreshJwtConfigType } from 'src/config/config.types';
import { Role } from '../user/user.types';
import { EmailService } from 'src/common/services/email/email.service';
import { env } from 'process';

@Injectable()
export class AuthService {
	constructor(
		private dbService: DatabaseService,
		private configService: ConfigService,
		private jwtService: JwtService,
		private emailService: EmailService
	) {}

	async login(
		user: UserWithAuthAccountsWithoutPassword,
		provider: 'email' | 'google'
	) {
		if (provider === 'email') {
			const payload: JwtPayload = {
				sub: user.id,
				email: user.email,
				role: user.role,
				provider: user.authAccounts[0].provider,
			};

			const refreshToken = this.jwtService.sign(payload, {
				expiresIn:
					this.configService.get<RefreshJwtConfigType>('refresh')!
						.expiration!,
				secret:
					this.configService.get<RefreshJwtConfigType>('refresh')!.secret,
			});

			await this.dbService.db
				.update(authAccounts)
				.set({ refreshToken, active: true })
				.where(
					and(
						eq(authAccounts.userId, user.id),
						eq(authAccounts.provider, 'email')
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

	private generateOtp(length = 6): string {
		const min = Math.pow(10, length - 1); // e.g. 100000
		const max = Math.pow(10, length) - 1; // e.g. 999999
		return String(Math.floor(Math.random() * (max - min + 1)) + min);
	}

	async registerLocal(
		email: string,
		firstName: string,
		lastName: string,
		password: string,
		role: Role
	) {
		const existingUser = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
		});

		if (existingUser) {
			throw new BadRequestException(
				'User with this email already exists'
			);
		}

		const newUser = await this.dbService.db
			.insert(users)
			.values({
				email,
				firstName,
				lastName,
				role,
			})
			.returning();

		const hashedPassword = await bcrypt.hash(password, 10);

		await this.dbService.db.insert(authAccounts).values({
			userId: newUser[0].id,
			provider: 'email',
			providerAccountId: email, // Using email as provider account ID for local auth
			passwordHash: hashedPassword,
		});

		const otp = this.generateOtp();
		await this.dbService.db.insert(otps).values({
			userId: newUser[0].id,
			otpHash: await bcrypt.hash(otp, 10),
			purpose: 'email_verification',
			expiresAt: new Date(Date.now() + 10 * 60 * 1000), // OTP valid for 15 minutes
			consumed: false,
		});

		this.emailService.sendEmail('email_verification', email, {
			name: firstName,
			otp,
		});

		return {
			message:
				'An email for OTP verification has been sent to your email.',
		};
	}

	async verifyEmail(email: string, otp: string) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
			with: {
				authAccounts: true,
			},
		});
		if (!user) throw new BadRequestException('User not found');

		// get latest OTP for email verification
		const [otpRecord] = await this.dbService.db.query.otps.findMany({
			where: and(
				eq(otps.userId, user.id),
				eq(otps.purpose, 'email_verification')
			),
			orderBy: [desc(otps.createdAt)],
			limit: 1,
		});

		const now = new Date();

		if (!otpRecord) throw new BadRequestException('Invalid OTP');
		if (otpRecord.consumed)
			throw new BadRequestException('This OTP has already been used');
		if (otpRecord.expiresAt <= now)
			throw new BadRequestException('OTP has expired');

		const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
		if (!isOtpValid) throw new BadRequestException('Invalid OTP');

		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
			provider: user.authAccounts[0].provider,
		};

		const refreshToken = this.jwtService.sign(payload, {
			expiresIn:
				this.configService.get<RefreshJwtConfigType>('refresh')!
					.expiration,
			secret:
				this.configService.get<RefreshJwtConfigType>('refresh')!.secret,
		});

		await this.dbService.db.transaction(async (tx) => {
			// consume only if it's still unconsumed AND not expired
			const updated = await tx
				.update(otps)
				.set({ consumed: true, updatedAt: now })
				.where(
					and(
						eq(otps.id, otpRecord.id),
						eq(otps.consumed, false),
						gt(otps.expiresAt, now) // still not expired at the moment of updating
					)
				)
				.returning({ id: otps.id });

			if (!updated || updated.length === 0) {
				// someone else consumed it or it expired between read and update
				throw new BadRequestException(
					'This OTP has already been used or expired'
				);
			}

			// mark the user's email auth account as verified
			await tx
				.update(authAccounts)
				.set({
					verified: true,
					updatedAt: now,
					active: true,
					refreshToken,
				})
				.where(
					and(
						eq(authAccounts.userId, user.id),
						eq(authAccounts.provider, 'email')
					)
				);
		});

		const { authAccounts: _removed, ...safeUser } = user;

		return {
			data: {
				accessToken: this.jwtService.sign(payload),
				refreshToken,
			},
			user: safeUser,
			message: 'Verification successful, you can now login.',
		};
	}

	// for a strategy/guard
	async validateUser(
		email: string,
		password: string
	): Promise<UserWithAuthAccountsWithoutPassword | null> {
		const user = (await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
			with: {
				authAccounts: {
					where: eq(authAccounts.provider, 'email'),
				},
			},
		})) as UserWithAuthAccounts | undefined;

		if (
			user &&
			(await bcrypt.compare(password, user.authAccounts[0].passwordHash!))
		) {
			const { authAccounts, ...rest } = user;
			const { passwordHash, ...account } = authAccounts[0];

			const safeUser = { ...rest, authAccounts: [account] };
			return safeUser;
		}
		return null;
	}

	// rate limit this endpoint later
	async resendVerificationEmail(email: string) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
			with: {
				authAccounts: true,
			},
		});
		if (!user) throw new BadRequestException('User not found');

		const otp = this.generateOtp();
		await this.dbService.db.insert(otps).values({
			userId: user.id,
			otpHash: await bcrypt.hash(otp, 10),
			purpose: 'email_verification',
			expiresAt: new Date(Date.now() + 10 * 60 * 1000), // OTP valid for 15 minutes
			consumed: false,
		});

		this.emailService.sendEmail('email_verification', email, {
			name: user.firstName,
			otp,
		});

		return {
			message:
				'An email for OTP verification has been sent to your email.',
		};
	}

	async refresh(user: UserWithAuthAccountsWithoutPassword) {
		// refresh token, send back access and refresh
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
			provider: user.authAccounts[0].provider,
		};

		const accessToken = this.jwtService.sign(payload);
		const refreshToken = this.jwtService.sign(payload, {
			expiresIn:
				this.configService.get<RefreshJwtConfigType>('refresh')!.expiration,
			secret:
				this.configService.get<RefreshJwtConfigType>('refresh')!.secret,
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

	async forgotPassword(email: string) {
		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.email, email),
		});
		if (!user) throw new BadRequestException('User account not found');

		const resetToken = this.jwtService.sign(
			{ sub: user.id, email: user.email, passwordReset: true },
			{ 
				expiresIn: this.configService.get<ForgotPasswordJwtConfigType>('forgotPasswordJwt')!.expiration,
				secret: this.configService.get<ForgotPasswordJwtConfigType>('forgotPasswordJwt')!.secret
			}
		);

		// Store token hash in otps table. A new table can be created later
		await this.dbService.db.insert(otps).values({
			userId: user.id,
			otpHash: await bcrypt.hash(resetToken, 10),
			purpose: 'password_reset',
			expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
			consumed: false,
		});

		await this.emailService.sendEmail('password_reset', email, {
			name: user.firstName,
			resetToken,
		});

		return {
			message:
				'An password reset link has been sent to your email.',
		};
	}

	async resetPassword(token: string, newPassword: string, confirmPassword: string) {
		let payload: any;

		if (newPassword !== confirmPassword) {
			throw new BadRequestException('Passwords do not match');
		}

		try {
			payload = this.jwtService.verify(token, {
				secret: this.configService.get<ForgotPasswordJwtConfigType>('forgotPasswordJwt')!.secret
			});
		} catch (e) {
			throw new BadRequestException('Invalid or expired link');
		}

		if (!payload.passwordReset || !payload.sub || !payload.email) {
			throw new BadRequestException('Invalid link');
		}

		// Check if token was already used
		const [otpRecord] = await this.dbService.db.query.otps.findMany({
			where: and(
				eq(otps.userId, payload.sub),
				eq(otps.purpose, 'password_reset')
			),
			orderBy: [desc(otps.createdAt)],
			limit: 1,
		});

		const now = new Date();

		if (!otpRecord) throw new BadRequestException('Invalid reset link');
		if (otpRecord.consumed) throw new BadRequestException('Reset link has already been used');
		if (otpRecord.expiresAt <= now) throw new BadRequestException('Reset link has expired');

		const isTokenValid = await bcrypt.compare(token, otpRecord.otpHash);
		if (!isTokenValid) throw new BadRequestException('Invalid reset link');


		const user = await this.dbService.db.query.users.findFirst({
			where: eq(users.id, payload.sub),
			with: {
				authAccounts: {
					where: eq(authAccounts.provider, 'email'),
				},
			},
		}) as UserWithAuthAccounts | undefined;

		if (!user) throw new BadRequestException('User account not found');

		const hashedPassword = await bcrypt.hash(newPassword, 10);

		await this.dbService.db.transaction(async (tx) => {
			// Mark token as consumed
			await tx
				.update(otps)
				.set({ consumed: true, updatedAt: now })
				.where(eq(otps.id, otpRecord.id));

			// Update password
			await tx
				.update(authAccounts)
				.set({ passwordHash: hashedPassword, updatedAt: new Date() })
				.where(
					and(
						eq(authAccounts.userId, user.id),
						eq(authAccounts.provider, 'email')
					)
				);
		});

		return { message: 'Password has been reset' };
	}
}
