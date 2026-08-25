import { defineStore } from 'pinia';
import { getToken, getUser, setToken, setUser, clearAuth } from '@/utils/auth';
import type { User, Role } from '@/types';
import * as authApi from '@/api/auth';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    user: getUser<User>() as User | null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s): Role | undefined => s.user?.role,
    isWarehouse: (s) => s.user?.role === 'warehouse',
  },
  actions: {
    setAuth(token: string, user: User) {
      this.token = token;
      this.user = user;
      setToken(token);
      setUser(user);
    },
    clear() {
      this.token = '';
      this.user = null;
      clearAuth();
    },
    async fetchProfile(): Promise<User | null> {
      try {
        const u = await authApi.profile();
        this.user = u;
        setUser(u);
        return u;
      } catch {
        return null;
      }
    },
    hasRole(...roles: Role[]): boolean {
      return !!this.user && roles.includes(this.user.role);
    },
  },
});
