import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertConfig } from './entities/alert-config.entity';

@Injectable()
export class AlertConfigService {
  constructor(
    @InjectRepository(AlertConfig)
    private readonly repo: Repository<AlertConfig>,
  ) {}

  async getNumber(key: string, def = 0): Promise<number> {
    const c = await this.repo.findOne({ where: { key, scope: 'global' } });
    if (!c || c.value === null || c.value === undefined) return def;
    const n = Number(c.value);
    return isNaN(n) ? def : n;
  }

  async getString(key: string, def = ''): Promise<string> {
    const c = await this.repo.findOne({ where: { key, scope: 'global' } });
    if (!c || c.value === null || c.value === undefined) return def;
    return c.value;
  }

  async set(key: string, value: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { key, scope: 'global' } });
    if (existing) {
      existing.value = value;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ key, value, scope: 'global' }));
    }
  }
}
