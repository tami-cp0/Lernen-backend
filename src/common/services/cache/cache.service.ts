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
		const key = `${this.streamSessionPrefix}:${chatId}:${userId}`;
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
		chatId: string,
		userId: string
	): Promise<StreamSessionData | null> {
		const key = `${this.streamSessionPrefix}:${chatId}:${userId}`;
		const data = await this.redis.get<string>(key);

		return data ? JSON.parse(data) : null;
	}

	/**
	 * Delete the current streaming session for a chat and user.
	 */
	async deleteStreamSessionData(
		chatId: string,
		userId: string
	): Promise<void> {
		const key = `${this.streamSessionPrefix}:${chatId}:${userId}`;
		await this.redis.del(key);
	}
}
