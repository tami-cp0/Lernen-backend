import { pgTable, uuid, varchar, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { relations } from "drizzle-orm";

// login_2fa can be added later
export const purposeEnum = pgEnum('otp_purpose', [
    'email_verification',
    'password_reset',
]);

// otpuserId index can be added later
export const otps = pgTable('otps', {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    otpHash: varchar('otp_hash', { length: 255 }).notNull(), // hashed OTP
    purpose: purposeEnum().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumed: boolean('consumed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const otpsRelations = relations(otps, ({ one }) => ({
    user: one(users, {
        fields: [otps.userId],
        references: [users.id],
    }),
}));
