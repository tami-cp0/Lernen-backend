import { UserWithAuthAccountsWithoutPassword } from "./auth/auth.types";

declare module 'express' {
  interface Request {
    user?: UserWithAuthAccountsWithoutPassword;
  }
}
