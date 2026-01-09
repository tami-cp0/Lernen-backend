import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { chats } from './chats';

export const chatSummaries = pgTable('chat_summaries', {
	id: uuid().defaultRandom().primaryKey(),
	chatId: uuid('chat_id')
		.references(() => chats.id, { onDelete: 'cascade' })
		.notNull(),
	summary: text().notNull(),
	startTurn: integer('start_turn').notNull(), // which message turn this summary covers
	endTurn: integer('end_turn').notNull(), // up to which message turn
	totalTokens: integer('total_tokens').default(0),
	createdAt: timestamp('created_at', { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const chatSummariesRelations = relations(chatSummaries, ({ one }) => ({
	chat: one(chats, {
		fields: [chatSummaries.chatId],
		references: [chats.id],
	}),
}));
