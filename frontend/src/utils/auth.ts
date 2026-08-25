const TOKEN_KEY = 'ir_token';
const USER_KEY = 'ir_user';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY);

export const getUser = <T = unknown>(): T | null => {
  const u = localStorage.getItem(USER_KEY);
  return u ? (JSON.parse(u) as T) : null;
};
export const setUser = (u: unknown): void =>
  localStorage.setItem(USER_KEY, JSON.stringify(u));
export const removeUser = (): void => localStorage.removeItem(USER_KEY);

export const clearAuth = (): void => {
  removeToken();
  removeUser();
};
