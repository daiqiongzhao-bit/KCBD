import { Role } from './roles.enum';

/**
 * 权限点定义（细粒度 RBAC，DB 可动态配置）。
 * permission 为权限点标识，name 为中文名，group 为分组。
 */
export interface PermissionPoint {
  permission: string;
  name: string;
  group: string;
}

/** 全部可用权限点清单（新增接口权限需在此登记）。 */
export const PERMISSION_POINTS: PermissionPoint[] = [
  { permission: 'dashboard.view', name: '查看仪表盘', group: '概览' },
  { permission: 'import.create', name: '数据导入', group: '导入' },
  { permission: 'inventory.view', name: '查看库存模块', group: '库存' },
  { permission: 'inventory.edit', name: '编辑/删除库存', group: '库存' },
  { permission: 'reconcile.view', name: '查看库存对账', group: '对账' },
  { permission: 'reconcile.clear', name: '清除对账引用', group: '对账' },
  { permission: 'diff.view', name: '查看差异处理', group: '对账' },
  { permission: 'unsorted.view', name: '查看未分拣监控', group: '报表' },
  { permission: 'unsorted.export', name: '导出未分拣CSV', group: '报表' },
  { permission: 'returns.view', name: '查看退货在途', group: '报表' },
  { permission: 'expiry.view', name: '查看效期预警', group: '报表' },
  { permission: 'gifts.manage', name: '维护赠品主档', group: '主档' },
  { permission: 'products.manage', name: '维护商品主档', group: '主档' },
  { permission: 'products.import', name: '导入商品主档', group: '主档' },
  { permission: 'logs.view', name: '查看操作日志', group: '系统' },
  { permission: 'users.manage', name: '账号管理', group: '系统' },
  { permission: 'roles.manage', name: '角色权限配置', group: '系统' },
  { permission: 'settings.manage', name: '系统设置', group: '系统' },
];

/** 各角色默认权限点（首次初始化写入 DB，后续可在界面动态调整）。 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.ADMIN]: PERMISSION_POINTS.map((p) => p.permission),
  [Role.WAREHOUSE]: [
    'dashboard.view',
    'import.create',
    'inventory.view',
    'inventory.edit',
    'reconcile.view',
    'reconcile.clear',
    'unsorted.view',
    'unsorted.export',
    'returns.view',
    'expiry.view',
    'gifts.manage',
    'products.manage',
    'products.import',
  ],
  [Role.FINANCE]: [
    'dashboard.view',
    'reconcile.view',
    'diff.view',
    'inventory.view',
    'expiry.view',
  ],
  [Role.MANAGER]: [
    'dashboard.view',
    'reconcile.view',
    'diff.view',
    'unsorted.view',
    'returns.view',
    'expiry.view',
  ],
};

/** 权限点查询辅助。 */
export const findPermissionPoint = (
  permission: string,
): PermissionPoint | undefined =>
  PERMISSION_POINTS.find((p) => p.permission === permission);

export const isValidPermission = (permission: string): boolean =>
  PERMISSION_POINTS.some((p) => p.permission === permission);
