
import { Reflector } from '@nestjs/core';
import { Role } from 'src/core/user/user.types';

export const Roles = Reflector.createDecorator<Role[]>();
