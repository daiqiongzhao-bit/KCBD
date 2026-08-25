import { useUserStore } from '@/stores/user';
import * as authApi from '@/api/auth';

/** 登录态 composable：封装登录 / 登出 / 注册。 */
export function useAuth() {
  const userStore = useUserStore();

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    userStore.setAuth(res.token, res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* 忽略 */
    }
    userStore.clear();
  };

  const register = (data: {
    username: string;
    password: string;
    display_name?: string;
    role?: Role;
  }) => authApi.register(data);

  return { login, logout, register };
}

import type { Role } from '@/types';
