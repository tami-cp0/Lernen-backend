import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { eq, lt } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import { streamSessions } from 'src/database/schema';

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
export class StreamSessionService {
	constructor(private databaseService: DatabaseService) {}

	/**
	 * Store the current streaming session for a chat.
	 * Only one session is kept per chat.
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
		const value: StreamSessionData = {
			chatId,
			userId,
			message,
			selectedDocumentIds: selectedDocumentIds || undefined,
			pageNumber: pageNumber || undefined,
			pageContent: pageContent || undefined,
			authTokenHash: createHash('sha256').update(authToken).digest('hex'),
		};

		await this.databaseService.db
			.insert(streamSessions)
			.values({
				chatId,
				payload: value,
				expiresAt: new Date(Date.now() + expirationSeconds * 1000),
			})
			.onConflictDoUpdate({
				target: streamSessions.chatId,
				set: {
					payload: value,
					expiresAt: new Date(Date.now() + expirationSeconds * 1000),
				},
			});

		return chatId;
	}

	/**
	 * Retrieve the current streaming session for a chat.
	 * Returns null if not found or expired.
	 */
	async getStreamSessionData(
		chatId: string
	): Promise<StreamSessionData | null> {
		const session =
			await this.databaseService.db.query.streamSessions.findFirst({
				where: eq(streamSessions.chatId, chatId),
			});

		if (!session || session.expiresAt < new Date()) {
			return null;
		}

		return session.payload as StreamSessionData;
	}

	/**
	 * Delete the current streaming session for a chat.
	 */
	async deleteStreamSessionData(chatId: string): Promise<void> {
		await this.databaseService.db
			.delete(streamSessions)
			.where(eq(streamSessions.chatId, chatId));
	}

	/**
	 * Delete expired stream sessions. Intended to be called opportunistically.
	 */
	async pruneExpiredSessions(): Promise<void> {
		await this.databaseService.db
			.delete(streamSessions)
			.where(lt(streamSessions.expiresAt, new Date()));
	}
}
