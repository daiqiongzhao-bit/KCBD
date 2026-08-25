import { get, post, put, del } from './http';
import type {
  User,
  RoleDefinition,
  PermissionPoint,
  PageResult,
} from '@/types';

export const listUsers = (
  params?: Record<string, unknown>,
): Promise<PageResult<User>> => get('/users', { params });

export const createUser = (data: {
  username: string;
  password: string;
  display_name?: string;
  role?: string;
}): Promise<{ id: number }> => post('/users', data);

export const updateUser = (
  id: number,
  data: {
    display_name?: string;
    role?: string;
    password?: string;
    status?: 'active' | 'frozen';
  },
): Promise<{ id: number }> => put(`/users/${id}`, data);

export const deleteUser = (id: number): Promise<{ id: number }> =>
  del(`/users/${id}`);

export const resetUserPassword = (
  id: number,
  newPassword: string,
): Promise<null> => post(`/users/${id}/reset-password`, { newPassword });

export const listRoles = (): Promise<RoleDefinition[]> => get('/roles');

/** 全部可用权限点（角色权限配置）。 */
export const listPermissionPoints = (): Promise<PermissionPoint[]> =>
  get('/roles/permission-points');

/** 各角色当前权限映射。 */
export const getAllRolePermissions = (): Promise<
  { role: string; permissions: string[] }[]
> => get('/roles/permissions');

/** 动态修改某角色权限点集合。 */
export const updateRolePermissions = (
  role: string,
  permissions: string[],
): Promise<{ role: string; permissions: string[] }> =>
  put(`/roles/${role}/permissions`, { permissions });
