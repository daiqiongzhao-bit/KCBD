import { Role } from '../../../common/constants/roles.enum';

/**
 * 角色定义（非数据库实体，作为静态权限元数据）。
 * 用于 /api/roles 接口返回角色清单与权限说明。
 */
export interface RoleDefinition {
  role: Role;
  name: string;
  description: string;
  permissions: string[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: Role.ADMIN,
    name: '系统管理员',
    description: '拥有全部权限，可管理用户、配置与所有业务数据',
    permissions: ['*'],
  },
  {
    role: Role.WAREHOUSE,
    name: '仓库管理员',
    description: '负责库存导入、对账、未分拣监控、退货在途（财务口径数据脱敏）',
    permissions: ['import', 'reconcile', 'unsorted', 'returns'],
  },
  {
    role: Role.FINANCE,
    name: '财务人员',
    description: '查看对账、差异处理、仪表盘与财务口径数据',
    permissions: ['reconcile', 'diff', 'dashboard', 'finance'],
  },
  {
    role: Role.MANAGER,
    name: '管理层',
    description: '查看仪表盘与多维看板，进行决策监控',
    permissions: ['dashboard', 'board'],
  },
];

export const getRoleDefinition = (role: Role): RoleDefinition | undefined =>
  ROLE_DEFINITIONS.find((r) => r.role === role);
