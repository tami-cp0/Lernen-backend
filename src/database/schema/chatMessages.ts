import {
  pgTable,
  uuid,
  integer,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { chats } from "./chats";

export const chatMessages = pgTable("chat_messages", {
  id: uuid().defaultRandom().primaryKey(),
  chatId: uuid("chat_id").references(() => chats.id, { onDelete: "set null" }).notNull(),
  turn: jsonb().$type<{ user: string; assistant: string }>().notNull(),
  totalTokens: integer("total_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMessages.chatId],
    references: [chats.id]
  })
}));
