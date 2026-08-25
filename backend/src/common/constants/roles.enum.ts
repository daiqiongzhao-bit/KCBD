/**
 * 系统四角色（RBAC）。
 */
export enum Role {
  ADMIN = 'admin',
  WAREHOUSE = 'warehouse',
  FINANCE = 'finance',
  MANAGER = 'manager',
}

export const ROLES: Role[] = Object.values(Role);
