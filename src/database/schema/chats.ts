import {
	pgTable,
	uuid,
	varchar,
	integer,
	timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { documents } from './documents';
import { chatMessages } from './chatMessages';
import { chatSummaries } from './chatSummaries';

export const chats = pgTable('chats', {
	id: uuid().defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.references(() => users.id, { onDelete: 'set null' })
		.notNull(),
	title: varchar({ length: 28 }).default('Untitled Chat').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const chatsRelations = relations(chats, ({ one, many }) => ({
	user: one(users, {
		fields: [chats.userId],
		references: [users.id],
	}),
	documents: many(documents),
	messages: many(chatMessages),
	summaries: many(chatSummaries),
}));
