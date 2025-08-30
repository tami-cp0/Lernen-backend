import { authAccounts } from "src/database/schema/authAccounts";
import { Role, User } from "../user/user.types";

export type AuthAccount = typeof authAccounts.$inferSelect;
export type UserWithAuthAccounts = User & {
  authAccounts: AuthAccount[];
};

export type UserWithAuthAccountsWithoutPassword = Omit<UserWithAuthAccounts, 'authAccounts'> & {
  authAccounts: Omit<AuthAccount, 'passwordHash'>[];
};

export type JwtPayload = {
  sub: string;
  email: string;
  provider: AuthAccount['provider'];
  role: Role;
  iat?: number;
  exp?: number;
};