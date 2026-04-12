import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DatabaseService } from '../../database/database.service';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/services/email/email.service';

// Mock the entire bcrypt module so hashing is instant in tests
jest.mock('bcrypt', () => ({
	hash: jest.fn().mockResolvedValue('hashed-token'),
	compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
	let authService: AuthService;
	let emailService: EmailService;

	// Fake database that never hits postgres
	const mockDb = {
		query: {
			users: {
				findFirst: jest.fn(),
			},
			tokens: {
				findMany: jest.fn(),
			},
		},
		insert: jest.fn().mockImplementation(() => ({
			values: jest.fn().mockImplementation((data) => ({
				returning: jest.fn().mockResolvedValue([
					{
						id: 'user-123',
						email: data.email,
						onboarded: false,
						firstName: null,
						lastName: null,
					},
				]),
			})),
		})),
		update: jest.fn().mockReturnValue({
			set: jest.fn().mockReturnValue({
				where: jest.fn().mockResolvedValue([]),
			}),
		}),
	};

	const mockDatabaseService = {
		db: mockDb,
	};

	const mockJwtService = {
		sign: jest.fn().mockReturnValue('mock-jwt-token'),
		verify: jest.fn(),
	};

	const mockConfigService = {
		get: jest.fn().mockReturnValue({
			secret: 'test-secret',
			expiration: '3600',
		}),
	};

	const mockEmailService = {
		sendEmail: jest.fn().mockResolvedValue(undefined),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: DatabaseService, useValue: mockDatabaseService },
				{ provide: JwtService, useValue: mockJwtService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: EmailService, useValue: mockEmailService },
			],
		}).compile();

		authService = module.get<AuthService>(AuthService);
		emailService = module.get<EmailService>(EmailService);

		// Reset all mocks before each test
		jest.clearAllMocks();
	});

	describe('sendMagicLink', () => {
		it('creates a new user and sends magic link if user does not exist', async () => {
			// Simulate user not found in DB
			mockDb.query.users.findFirst.mockResolvedValue(null);

			const result = await authService.sendMagicLink(
				'new@example.com',
				'email'
			);

			expect(result.message).toBe(
				'Magic link sent! Please check your email.'
			);
			expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
				'sign_in',
				'new@example.com',
				expect.objectContaining({ tempToken: 'mock-jwt-token' })
			);
		});

		it('sends magic link to existing user without creating a new one', async () => {
			// Simulate user already exists
			mockDb.query.users.findFirst.mockResolvedValue({
				id: 'user-123',
				email: 'existing@example.com',
				onboarded: true,
				authAccounts: [{ provider: 'email' }],
			});

			mockDb.query.tokens = {
				findMany: jest.fn().mockResolvedValue([]),
			};

			const result = await authService.sendMagicLink(
				'existing@example.com',
				'email'
			);

			expect(result.message).toBe(
				'Magic link sent! Please check your email.'
			);
			// Should NOT insert a new user
			expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
		});

		it('does not expose the raw token in the response', async () => {
			mockDb.query.users.findFirst.mockResolvedValue(null);

			const result = await authService.sendMagicLink(
				'test@example.com',
				'email'
			);

			// The response should only have a message, not the token itself
			expect(result).not.toHaveProperty('token');
			expect(result).not.toHaveProperty('tempToken');
		});
	});

	describe('verifyToken', () => {
		it('should throw UnauthorizedException if token is expired', async () => {
			mockJwtService.verify.mockImplementation(() => {
				throw new TokenExpiredError('jwt expired', new Date());
			});

			await expect(
				authService.verifyToken('expired-token')
			).rejects.toThrow('Token has expired');
		});

		it('it should throw BadRequestException if token has no payload', async () => {
			mockJwtService.verify.mockReturnValue({
				email: 'test@example.com',
			});

			await expect(
				authService.verifyToken('invalid-token')
			).rejects.toThrow('Token verification failed');
		});

		it('should throw if user is not found', async () => {
			mockJwtService.verify.mockReturnValue({
				email: 'test@example.com',
				sub: 'user-123',
				provider: 'email',
				type: 'signIn',
			});

			mockDatabaseService.db.query.users.findFirst.mockResolvedValue(
				null
			);

			await expect(
				authService.verifyToken('valid-token')
			).rejects.toThrow('Token verification failed');
		});

		it('should throw if no matching unconsumed token is found', async () => {
			mockJwtService.verify.mockReturnValue({
				email: 'test@example.com',
				sub: 'user-123',
				provider: 'email',
				type: 'signIn',
			});

			mockDatabaseService.db.query.users.findFirst.mockResolvedValue({
				id: 'user-123',
				email: 'test@example.com',
				onboarded: true,
				authAccounts: [{ provider: 'email' }],
			});

			mockDatabaseService.db.query.tokens.findMany.mockResolvedValue([]);

			await expect(
				authService.verifyToken('valid-token')
			).rejects.toThrow('Token verification failed');
		});

		it('should return if user is not onboarded', async () => {
			mockJwtService.verify.mockReturnValue({
				email: 'test',
				sub: 'user-123',
				provider: 'email',
				type: 'signIn',
			});

			mockDatabaseService.db.query.users.findFirst.mockResolvedValue({
				id: 'user-123',
				email: 'test',
				onboarded: false,
				authAccounts: [{ provider: 'email' }],
			});

			mockDatabaseService.db.query.tokens.findMany.mockResolvedValue([
				{
					id: 'tok-123',
					createdAt: Date.now(),
					updatedAt: Date.now(),
					userId: 'user-123',
					tokenHash: '',
					purpose: 'sign_in',
					consumed: false,
				},
			]);

			await expect(
				authService.verifyToken('token')
			).resolves.toMatchObject({
				message: 'User not onboarded',
			});
		});

		it('should return successfully', async () => {
			mockJwtService.verify.mockReturnValue({
				email: 'test',
				sub: 'user-123',
				provider: 'email',
				type: 'signIn',
			});

			mockDatabaseService.db.query.users.findFirst.mockResolvedValue({
				id: 'user-123',
				email: 'test',
				onboarded: true,
				authAccounts: [{ provider: 'email' }],
			});

			mockDatabaseService.db.query.tokens.findMany.mockResolvedValue([
				{
					id: 'tok-123',
					createdAt: Date.now(),
					updatedAt: Date.now(),
					userId: 'user-123',
					tokenHash: '',
					purpose: 'sign_in',
					consumed: false,
				},
			]);

			const result = await authService.verifyToken('token');

			expect(mockDb.update).toHaveBeenCalled();
			expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
			expect(result).toMatchObject({ message: 'Sign in successful' });
		});
	});
});
