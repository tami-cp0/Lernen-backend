import {
	pgTable,
	uuid,
	integer,
	timestamp,
	jsonb,
	boolean,
	index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { chats } from './chats';

export const chatMessages = pgTable(
	'chat_messages',
	{
		id: uuid().defaultRandom().primaryKey(),
		chatId: uuid('chat_id')
			.references(() => chats.id, { onDelete: 'set null' })
			.notNull(),
		turn: jsonb().$type<{ user: string; assistant: string }>().notNull(),
		helpful: boolean(),
		totalTokens: integer('total_tokens').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		chatIdIdx: index('chat_messages_chat_id_idx').on(table.chatId),
		createdAtIdx: index('chat_messages_created_at_idx').on(table.createdAt),
	})
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
	chat: one(chats, {
		fields: [chatMessages.chatId],
		references: [chats.id],
	}),
}));
