import { authAccounts } from "src/database/schema/authAccounts";
import { User } from "../user/user.types";

export type AuthAccount = typeof authAccounts.$inferSelect;
export type UserWithAuthAccounts = User & {
  authAccounts: AuthAccount[];
};

export type JwtPayload = {
  sub: string;
  email: string;
  provider: AuthAccount['provider'];
  onboarded: boolean;
  magicLink?: boolean;
  iat?: number;
  exp?: number;
};