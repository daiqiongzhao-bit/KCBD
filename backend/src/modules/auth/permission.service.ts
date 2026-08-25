import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/constants/roles.enum';
import {
  DEFAULT_ROLE_PERMISSIONS,
  isValidPermission,
  PERMISSION_POINTS,
  PermissionPoint,
} from '../../common/constants/permissions.const';
import { RolePermission } from './entities/role-permission.entity';

/**
 * 角色权限服务：权限点清单 + 各角色权限的读取与动态修改。
 * 权限映射持久化于 role_permissions 表，首次访问某角色时按默认值播种。
 */
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rpRepo: Repository<RolePermission>,
  ) {}

  /** 全部权限点（含分组，供前端配置界面展示）。 */
  listPoints(): PermissionPoint[] {
    return PERMISSION_POINTS;
  }

  /** 读取某角色的权限点集合（无记录时播种默认值）。 */
  async getRolePermissions(role: Role): Promise<string[]> {
    const rows = await this.rpRepo.find({ where: { role } });
    if (rows.length === 0) {
      const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
      if (defaults.length > 0) {
        await this.rpRepo.save(
          defaults.map((permission) =>
            this.rpRepo.create({ role, permission }),
          ),
        );
      }
      return defaults;
    }
    return rows.map((r) => r.permission);
  }

  /** 读取全部角色及其权限（供管理界面列表）。 */
  async getAllRolePermissions(): Promise<
    { role: Role; permissions: string[] }[]
  > {
    const roles: Role[] = Object.values(Role);
    const result: { role: Role; permissions: string[] }[] = [];
    for (const role of roles) {
      result.push({ role, permissions: await this.getRolePermissions(role) });
    }
    return result;
  }

  /** 覆盖某角色的权限点集合（校验权限点合法性；仅允许调整，不可删除全部）。 */
  async setRolePermissions(
    role: Role,
    permissions: string[],
  ): Promise<{ role: Role; permissions: string[] }> {
    const unique = [...new Set(permissions)];
    for (const p of unique) {
      if (!isValidPermission(p)) {
        throw new Error(`无效权限点: ${p}`);
      }
    }
    // 清空后重写
    await this.rpRepo.delete({ role });
    if (unique.length > 0) {
      await this.rpRepo.save(
        unique.map((permission) =>
          this.rpRepo.create({ role, permission }),
        ),
      );
    }
    return { role, permissions: unique };
  }
}
