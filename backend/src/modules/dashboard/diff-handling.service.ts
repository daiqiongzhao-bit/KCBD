import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiffHandling } from './entities/diff-handling.entity';
import { InventoryReconcile } from '../reconcile/entities/inventory-reconcile.entity';
import { DiffCause, WarehouseType } from '../../common/constants/types';
import { normalizePage } from '../../common/utils/pagination';
import { OperationLogService } from './operation-log.service';

export interface HandleInput {
  cause?: DiffCause;
  note?: string;
  status?: string;
}

@Injectable()
export class DiffHandlingService {
  constructor(
    @InjectRepository(DiffHandling)
    private readonly handlingRepo: Repository<DiffHandling>,
    @InjectRepository(InventoryReconcile)
    private readonly reconcileRepo: Repository<InventoryReconcile>,
    private readonly operationLog: OperationLogService,
  ) {}

  /** 差异处理列表：返回存在差异的对账行，并附带最新处理状态。 */
  async list(query: {
    status?: string;
    diffType?: string;
    warehouse?: WarehouseType;
    page?: number;
    size?: number;
  }) {
    const { page, size } = normalizePage(query.page, query.size);
    const qb = this.reconcileRepo.createQueryBuilder('r');
    qb.where('r.status != :m', { m: 'match' });
    if (query.diffType) qb.andWhere('r.diff_type = :d', { d: query.diffType });
    if (query.warehouse) qb.andWhere('r.warehouse = :w', { w: query.warehouse });
    const total = await qb.getCount();

    qb.orderBy('r.diff_value', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const rows = await qb.getMany();

    const items = await Promise.all(
      rows.map(async (r) => {
        const latest = await this.handlingRepo.findOne({
          where: { reconcile_id: r.id },
          order: { created_at: 'DESC' },
        });
        return {
          ...r,
          handleStatus: latest ? latest.status : 'pending',
          handleCause: latest ? latest.cause : 'unset',
          latestNote: latest ? latest.note : null,
        };
      }),
    );

    // 若按处理状态过滤
    const filtered =
      query.status && query.status !== 'all'
        ? items.filter((i) => i.handleStatus === query.status)
        : items;

    return { items: filtered, total: filtered.length };
  }

  /** 处理时间线（审计）。 */
  async timeline(reconcileId: number): Promise<DiffHandling[]> {
    return this.handlingRepo.find({
      where: { reconcile_id: reconcileId },
      order: { created_at: 'ASC' },
    });
  }

  /** 标注 / 改状态（写审计时间线）。 */
  async handle(
    reconcileId: number,
    input: HandleInput,
    operatorId?: number,
  ): Promise<DiffHandling> {
    const record = this.handlingRepo.create({
      reconcile_id: reconcileId,
      status: input.status || 'processing',
      cause: (input.cause as DiffCause) || 'unset',
      note: input.note || null,
      operator_id: operatorId ?? null,
    });
    const saved = await this.handlingRepo.save(record);
    await this.operationLog.log(
      'handle',
      `reconcile#${reconcileId}`,
      { status: saved.status, cause: saved.cause },
      operatorId,
    );
    return saved;
  }

  /** 批量标注 / 改状态：对选中的对账行逐条写处理记录。返回成功/失败数。 */
  async handleBatch(
    reconcileIds: number[],
    input: HandleInput,
    operatorId?: number,
  ): Promise<{ ok: number; fail: number; skipped: number }> {
    const unique = [...new Set(reconcileIds)].filter(
      (id) => Number.isFinite(id) && id > 0,
    );
    if (unique.length === 0) {
      return { ok: 0, fail: 0, skipped: 0 };
    }
    let ok = 0;
    let fail = 0;
    for (const id of unique) {
      const exists = await this.reconcileRepo.findOne({ where: { id } });
      if (!exists) {
        fail++;
        continue;
      }
      try {
        await this.handle(id, input, operatorId);
        ok++;
      } catch {
        fail++;
      }
    }
    return { ok, fail, skipped: unique.length - ok - fail };
  }
}
