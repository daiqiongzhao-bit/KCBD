import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../../common/constants/roles.enum';

/**
 * 角色-权限点映射表（DB 可动态配置）。
 * 一行 = 某角色拥有某权限点；初始化时按 DEFAULT_ROLE_PERMISSIONS 播种。
 */
@Entity('role_permissions')
@Index('uq_role_permission', ['role', 'permission'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16 })
  role: Role;

  @Column({ type: 'varchar', length: 64 })
  permission: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
