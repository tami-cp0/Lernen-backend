import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import { RedisConfigType } from 'src/config/config.types';

type StreamSessionData = {
	chatId: string;
	userId: string;
	message: string;
	selectedDocumentIds: string[] | undefined;
	pageNumber: number | undefined;
	pageContent: string | undefined;
	authTokenHash: string;
};

@Injectable()
export class CacheService {
	private redis: Redis;
	private streamSessionPrefix = 'streamSession';
	private userCachePrefix = 'user';
	private userCacheTTL = 3600; // 1 hour TTL for user data

	constructor(private configService: ConfigService) {
		this.redis = new Redis({
			url: this.configService.get<RedisConfigType>('redis')!.url,
			token: this.configService.get<RedisConfigType>('redis')!.token,
		});
	}

	/**
	 * Store the current streaming session for a chat and user.
	 * Only one session is kept per chat and user.
	 */
	async storeStreamSessionData(
		chatId: string,
		message: string,
		userId: string,
		authToken: string,
		selectedDocumentIds?: string[],
		pageNumber?: number,
		pageContent?: string,
		expirationSeconds = 3600
	): Promise<string> {
		const key = `${this.streamSessionPrefix}:${chatId}`;
		const value: StreamSessionData = {
			chatId,
			userId,
			message,
			selectedDocumentIds: selectedDocumentIds || undefined,
			pageNumber: pageNumber || undefined,
			pageContent: pageContent || undefined,
			authTokenHash: createHash('sha256').update(authToken).digest('hex'),
		};

		await this.redis.set(key, JSON.stringify(value), {
			ex: expirationSeconds,
		});

		return key;
	}

	/**
	 * Retrieve the current streaming session for a chat and user.
	 * Returns null if not found.
	 */
	async getStreamSessionData(
		chatId: string
	): Promise<StreamSessionData | null> {
		const key = `${this.streamSessionPrefix}:${chatId}`;
		const data = await this.redis.get<StreamSessionData>(key);

		return data;
	}

	/**
	 * Delete the current streaming session for a chat and user.
	 */
	async deleteStreamSessionData(chatId: string): Promise<void> {
		const key = `${this.streamSessionPrefix}:${chatId}`;
		await this.redis.del(key);
	}

	/**
	 * Cache user data in Redis with TTL
	 * @param userId - User ID
	 * @param userData - User data to cache
	 * @param ttl - Time to live in seconds (default: 1 hour)
	 */
	async cacheUser(
		userId: string,
		userData: {
			id: string;
			educationLevel: string | null;
			email: string;
			firstName: string | null;
			lastName: string | null;
		},
		ttl: number = this.userCacheTTL
	): Promise<void> {
		const key = `${this.userCachePrefix}:${userId}`;
		await this.redis.set(key, JSON.stringify(userData), { ex: ttl });
	}

	/**
	 * Retrieve cached user data from Redis
	 * @param userId - User ID
	 * @returns User data or null if not found
	 */
	async getCachedUser(
		userId: string
	): Promise<{
		id: string;
		educationLevel: string | null;
		email: string;
		firstName: string | null;
		lastName: string | null;
	} | null> {
		const key = `${this.userCachePrefix}:${userId}`;
		const data = await this.redis.get<string>(key);

		if (!data) {
			return null;
		}

		// Handle both string and object responses from Redis
		return typeof data === 'string' ? JSON.parse(data) : data;
	}

	/**
	 * Invalidate cached user data
	 * @param userId - User ID
	 */
	async invalidateUserCache(userId: string): Promise<void> {
		const key = `${this.userCachePrefix}:${userId}`;
		await this.redis.del(key);
	}
}
