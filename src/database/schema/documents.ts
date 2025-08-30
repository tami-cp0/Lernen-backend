import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { chats } from "./chats";

export const documents = pgTable("documents", {
  id: uuid().defaultRandom().primaryKey(),
  chatId: uuid("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  fileName: varchar({ length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileSize: integer("file_size_mb").notNull(),
  vectorStoreId: varchar("vector_store_id", { length: 255 }).notNull(),
  vectorStoreFileId: varchar("vector_store_file_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const documentsRelations = relations(documents, ({ one }) => ({
  chat: one(chats, {
    fields: [documents.chatId],
    references: [chats.id]
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id]
  })
}));
