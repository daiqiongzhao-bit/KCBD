import { getUser } from '@/utils/auth';
import type { Role } from '@/types';

/**
 * 按钮级 RBAC 指令：v-permission="'admin'" 或 v-permission="['admin','finance']"。
 * 当前用户无权限时移除该元素（admin 始终放行）。
 */
export const permission = {
  mounted(el: HTMLElement, binding: { value: Role | Role[] }): void {
    const user = getUser<{ role: Role }>();
    const role: Role | undefined = user?.role;
    const allowed = binding.value;
    const ok = Array.isArray(allowed)
      ? allowed.includes(role as Role)
      : allowed === role || role === 'admin';
    if (!ok && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  },
};
