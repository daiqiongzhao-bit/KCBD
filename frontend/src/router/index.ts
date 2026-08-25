import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { getToken, getUser } from '@/utils/auth';
import type { Role } from '@/types';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/BlankLayout.vue'),
    meta: { public: true, title: '登录' },
    children: [
      { path: '', component: () => import('@/views/LoginView.vue') },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    meta: { requiresAuth: true, title: '首页' },
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'import',
        name: 'import',
        component: () => import('@/views/ImportView.vue'),
        meta: { title: '数据导入' },
      },
      {
        path: 'inventory',
        name: 'inventory',
        component: () => import('@/views/InventoryView.vue'),
        meta: { title: '库存' },
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('@/views/ProductView.vue'),
        meta: { title: '商品主档信息管理' },
      },
      {
        path: 'reconcile',
        name: 'reconcile',
        component: () => import('@/views/ReconcileView.vue'),
        meta: { title: '库存对账' },
      },
      {
        path: 'report',
        name: 'report',
        component: () => import('@/views/ReportView.vue'),
        meta: { title: '对账报告' },
      },
      {
        path: 'diff',
        name: 'diff',
        component: () => import('@/views/DiffHandlingView.vue'),
        meta: { title: '差异处理' },
      },
      {
        path: 'unsorted',
        name: 'unsorted',
        component: () => import('@/views/UnsortedView.vue'),
        meta: { title: '未分拣监控' },
      },
      {
        path: 'returns',
        name: 'returns',
        component: () => import('@/views/ReturnsView.vue'),
        meta: { title: '退货在途' },
      },
      {
        path: 'expiry',
        name: 'expiry',
        component: () => import('@/views/ExpiryView.vue'),
        meta: { title: '效期预警' },
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('@/views/LogsView.vue'),
        meta: { title: '操作日志' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/UsersView.vue'),
        meta: { title: '账号与权限管理', roles: ['admin'] },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '系统设置', roles: ['admin'] },
      },
    ],
  },
  {
    path: '/403',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '无访问权限', code: 403 },
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  // public 路由直接放行（如 /login、/403、/404）
  if (to.meta.public) return true;
  const token = getToken();
  if (!token) {
    // 未登录：附带 redirect 参数，登录后跳回原目标
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  // 登录态但需要角色
  const roles = to.meta.roles as Role[] | undefined;
  const user = getUser<{ role: Role }>();
  if (roles && user && !roles.includes(user.role)) {
    return '/403';
  }
  return true;
});

export default router;
