import { users } from "src/database/schema";

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Role = typeof users.$inferSelect['role'];