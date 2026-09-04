import { pgTable, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const streamSessions = pgTable(
	'stream_sessions',
	{
		chatId: varchar('chat_id', { length: 255 }).primaryKey(),
		payload: jsonb('payload').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		expiresAtIdx: index('stream_sessions_expires_at_idx').on(
			table.expiresAt
		),
	})
);
