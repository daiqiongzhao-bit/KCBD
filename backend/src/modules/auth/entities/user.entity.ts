import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../../common/constants/roles.enum';

/** 用户表（含 RBAC 角色字段）。 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 64 })
  username: string;

  // select:false 防止普通查询/返回路径泄露密码哈希（P0-2）
  @Column({ name: 'password_hash', select: false })
  password_hash: string;

  @Column({ name: 'display_name', length: 128, default: '' })
  display_name: string;

  @Column({ type: 'varchar', length: 16, default: Role.WAREHOUSE })
  role: Role;

  /** 账号状态：active 正常 / frozen 冻结（冻结后禁止登录）。 */
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: 'active' | 'frozen';

  /** token 版本号：修改/重置密码后 +1，旧 token 立即失效。 */
  @Column({ name: 'token_version', default: 1 })
  token_version: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
