import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../constants/roles.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permission.decorator';
import { PermissionService } from '../../modules/auth/permission.service';

/**
 * 角色/权限守卫：
 * - 若路由标记 @Roles(...)，校验当前用户角色在允许列表中；
 * - 若路由标记 @RequirePermission(...)，校验当前用户角色的权限点（任一满足即可）；
 * - 两者可同时标记，同时存在时需同时满足。
 * - 未标记任何角色/权限的路由直接放行（不校验 req.user，公开接口不受影响）。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions?: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 路由未声明任何角色/权限约束 → 放行（JwtAuthGuard 已处理鉴权）
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !user.role) {
      throw new ForbiddenException('无访问权限');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException('无访问权限');
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!this.permissions) {
        // 守卫未被注入权限服务（如未配置）时，仅 admin 放行
        if (user.role !== Role.ADMIN) {
          throw new ForbiddenException('无访问权限');
        }
      } else {
        const userPerms = await this.permissions.getRolePermissions(user.role);
        const ok = requiredPermissions.some((p) => userPerms.includes(p));
        if (!ok) {
          throw new ForbiddenException('无访问权限');
        }
      }
    }

    return true;
  }
}
