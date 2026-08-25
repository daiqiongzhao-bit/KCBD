import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog } from './entities/operation-log.entity';
import { User } from '../auth/entities/user.entity';
import { normalizePage } from '../../common/utils/pagination';

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly repo: Repository<OperationLog>,
  ) {}

  async log(
    action: string,
    target?: string,
    detail?: unknown,
    userId?: number,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        action,
        target: target || null,
        detail: detail ?? null,
        user_id: userId ?? null,
      }),
    );
  }

  async list(query: {
    user?: number;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }) {
    const { page, size } = normalizePage(query.page, query.size);
    const qb = this.repo.createQueryBuilder('o');
    if (query.user) qb.andWhere('o.user_id = :u', { u: query.user });
    if (query.action) qb.andWhere('o.action = :a', { a: query.action });
    if (query.from)
      qb.andWhere('o.created_at >= :from', { from: query.from });
    if (query.to) qb.andWhere('o.created_at <= :to', { to: query.to });
    qb.leftJoin(User, 'u', 'u.id = o.user_id')
      .addSelect('u.username', 'username')
      .addSelect('u.display_name', 'display_name')
      .orderBy('o.created_at', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const { entities, raw } = await qb.getRawAndEntities();
    const items = entities.map((e, i) => ({
      ...e,
      operator_name:
        raw[i]?.display_name || raw[i]?.username || null,
    }));
    const total = await qb.clone().getCount();
    return { items, total };
  }
}
