import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { Role } from '../../common/constants/roles.enum';
import { ROLE_DEFINITIONS } from './entities/role.entity';
import { PermissionService } from './permission.service';

/** 角色与权限管理（清单 + 动态配置）。 */
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly permissions: PermissionService) {}

  /** 角色清单（静态定义，含描述）。 */
  @Get()
  list() {
    return ROLE_DEFINITIONS;
  }

  /** 全部可用权限点（供配置界面勾选）。 */
  @Get('permission-points')
  points() {
    return this.permissions.listPoints();
  }

  /** 各角色当前权限点映射（admin 可查看）。 */
  @Roles(Role.ADMIN)
  @Get('permissions')
  allPermissions() {
    return this.permissions.getAllRolePermissions();
  }

  /** 动态修改某角色的权限点集合（admin）。 */
  @Roles(Role.ADMIN)
  @RequirePermission('roles.manage')
  @Put(':role/permissions')
  async updateRolePermissions(
    @Param('role') role: string,
    @Body('permissions') permissions: string[],
  ) {
    const r = role as Role;
    if (!Object.values(Role).includes(r)) {
      return { code: 400, message: `无效角色: ${role}` };
    }
    if (!Array.isArray(permissions)) {
      return { code: 400, message: 'permissions 必须是数组' };
    }
    try {
      return await this.permissions.setRolePermissions(r, permissions);
    } catch (e: any) {
      return { code: 400, message: e.message || '设置失败' };
    }
  }
}
