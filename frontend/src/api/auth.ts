import { get, post, put, del } from './http';
import type {
  LoginResult,
  User,
  RoleDefinition,
  PageResult,
} from '@/types';

export const login = (username: string, password: string): Promise<LoginResult> =>
  post('/auth/login', { username, password });

export const logout = (): Promise<null> => post('/auth/logout');

export const profile = (): Promise<User> => get('/auth/profile');

export const register = (data: {
  username: string;
  password: string;
  display_name?: string;
  role?: string;
}): Promise<User> => post('/auth/register', data);

/** 自助注册（公开接口，默认 warehouse 角色）。 */
export const selfRegister = (data: {
  username: string;
  password: string;
  display_name?: string;
}): Promise<User> => post('/auth/self-register', data);

export const changePassword = (
  oldPassword: string,
  newPassword: string,
): Promise<null> =>
  post('/auth/change-password', { oldPassword, newPassword });

export const resetPassword = (
  id: number,
  newPassword: string,
): Promise<null> => post(`/auth/reset-password/${id}`, { newPassword });

export const listUsers = (params: Record<string, unknown>): Promise<PageResult<User>> =>
  get('/users', { params });

export const createUser = (data: {
  username: string;
  password: string;
  display_name?: string;
  role?: string;
}): Promise<{ id: number }> => post('/users', data);

export const updateUser = (
  id: number,
  data: { display_name?: string; role?: string; password?: string },
): Promise<{ id: number }> => put(`/users/${id}`, data);

export const deleteUser = (id: number): Promise<{ id: number }> =>
  del(`/users/${id}`);

export const listRoles = (): Promise<RoleDefinition[]> => get('/roles');
