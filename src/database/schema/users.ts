import { relations } from "drizzle-orm";
import { pgTable, boolean, timestamp, uuid, varchar, pgEnum, text } from "drizzle-orm/pg-core";
import { authAccounts } from "./authAccounts";
import { documents } from "./documents";
import { chats } from "./chats";

export const roleEnum = pgEnum('role', ['user', 'admin']);

export const users = pgTable('users', {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 254 }).notNull().unique(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    educationLevel: varchar('education_level', { length: 100 }), // e.g., "High School", "Bachelor's", etc.
    preferences: text().array(),
    onboarded: boolean().default(false).notNull(),
    role: roleEnum().default('user').notNull(),
    emailNotifications: boolean('email_notifications').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
    authAccounts: many(authAccounts),
    documents: many(documents),
    chats: many(chats)
}));
