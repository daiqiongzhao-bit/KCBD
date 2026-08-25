import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 标记路由所需的权限点（细粒度 RBAC，权限点见 permissions.const.ts）。
 * 用法：@RequirePermission('inventory.edit') 或 @RequirePermission('users.manage', 'roles.manage')（任一满足即可）。
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
