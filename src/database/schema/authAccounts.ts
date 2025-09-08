import { pgEnum, pgTable, timestamp, uuid, varchar, text, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { relations } from "drizzle-orm";

export const providerEnum = pgEnum('provider', ['google', 'magic_link']);

export const authAccounts = pgTable('auth_accounts', {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: "cascade" }).notNull(),
    provider: providerEnum().notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(), // e.g., Google sub or email for magic_link
    refreshToken: text('refresh_token'), // user's active refresh token (if any)
    active: boolean('active').default(false), // to get last used login method
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastLogin: timestamp('last_login', { withTimezone: true }),
}, (table) => ({
    userProviderUnique: uniqueIndex('user_provider_unique').on(table.provider, table.providerAccountId)
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
    user: one(users, {
        fields: [authAccounts.userId],
        references: [users.id]
    })
}));