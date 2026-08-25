import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../modules/auth/entities/user.entity';
import { AlertConfig } from '../../modules/dashboard/entities/alert-config.entity';
import { Role } from '../../common/constants/roles.enum';

/**
 * 初始种子：创建默认管理员与演示账号，写入默认告警/容差配置。
 * 默认管理员：admin / admin123
 *
 * ⚠️ 安全警告：以下账号使用固定默认口令，仅用于本地开发/演示。
 * 生产环境必须：1) 通过环境变量覆盖管理员密码；2) 首次登录后立即修改密码；
 * 3) 配置 JWT_SECRET（见 jwt.strategy.ts）。
 */
export async function seedDatabase(ds: DataSource): Promise<void> {
  const userRepo = ds.getRepository(User);
  const cfgRepo = ds.getRepository(AlertConfig);

  const ensureUser = async (
    username: string,
    password: string,
    displayName: string,
    role: Role,
  ) => {
    const exists = await userRepo.findOne({ where: { username } });
    if (!exists) {
      await userRepo.save(
        userRepo.create({
          username,
          password_hash: await bcrypt.hash(password, 10),
          display_name: displayName,
          role,
        }),
      );
    }
  };

  await ensureUser('admin', 'admin123', '系统管理员', Role.ADMIN);
  await ensureUser('warehouse', 'warehouse123', '仓库管理员', Role.WAREHOUSE);
  await ensureUser('finance', 'finance123', '财务人员', Role.FINANCE);
  await ensureUser('manager', 'manager123', '管理层', Role.MANAGER);

  const defaults: [string, string][] = [
    ['diff_rate_tolerance', '0.005'],
    ['unsorted_overdue_days', '3'],
    ['expiry_warn_days', '90'],
    ['expiry_urgent_days', '30'],
  ];
  for (const [k, v] of defaults) {
    const exists = await cfgRepo.findOne({ where: { key: k, scope: 'global' } });
    if (!exists) {
      await cfgRepo.save(cfgRepo.create({ key: k, value: v, scope: 'global' }));
    }
  }
}
