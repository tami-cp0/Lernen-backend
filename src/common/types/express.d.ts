import { User } from '../../core/user/user.types';
declare global {
    namespace Express {
      interface Request {
        user?: User
      }
    }
}

export {};