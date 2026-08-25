import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles.enum';

export const ROLES_KEY = 'roles';

/** 标记路由允许访问的角色集合。 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
