import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../modules/auth/entities/user.entity';
import { Role } from '../../common/constants/roles.enum';
import { AlertConfig } from '../../modules/dashboard/entities/alert-config.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AlertConfig)
    private readonly alertRepo: Repository<AlertConfig>,
  ) {}

  async onModuleInit() {
    await this.seedAdmin();
    await this.seedAlertConfigs();
  }

  private async seedAdmin() {
    const exists = await this.userRepo.findOne({ where: { username: 'admin' } });
    if (exists) return;
    const hash = await bcrypt.hash('admin123', 10);
    const admin = this.userRepo.create({
      username: 'admin',
      password_hash: hash,
      display_name: '系统管理员',
      role: Role.ADMIN,
    });
    await this.userRepo.save(admin);
    console.log('Seeded default admin: admin / admin123');
  }

  private async seedAlertConfigs() {
    const defaults = [
      { key: 'diff_rate_tolerance', value: '0.005' },
      { key: 'unsorted_overdue_days', value: '3' },
      { key: 'unsorted_urgent_days', value: '7' },
      { key: 'expiry_warn_days', value: '90' },
      { key: 'expiry_urgent_days', value: '30' },
    ];
    for (const d of defaults) {
      const exists = await this.alertRepo.findOne({
        where: { key: d.key, scope: 'global' },
      });
      if (!exists) {
        await this.alertRepo.save(
          this.alertRepo.create({ key: d.key, value: d.value, scope: 'global' }),
        );
      }
    }
  }
}
