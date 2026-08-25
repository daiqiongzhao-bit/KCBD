import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryReconcile } from './entities/inventory-reconcile.entity';
import { InventoryService } from '../inventory/inventory.service';
import { ProductService } from '../inventory/product.service';
import { NotifyService } from '../notify/notify.service';
import { AlertConfigService } from '../dashboard/alert-config.service';
import { OperationLogService } from '../dashboard/operation-log.service';
import { reconcileNormalWarehouse } from './engine/normal-warehouse.engine';
import { reconcileExpiredWarehouse } from './engine/expired-warehouse.engine';
import { WmsInventory } from '../inventory/entities/wms-inventory.entity';
import { WarehouseType } from '../../common/constants/types';
import { normalizePage } from '../../common/utils/pagination';
import * as XLSX from 'xlsx';

export interface ReconcileSummary {
  total: number;
  match: number;
  diff: number;
  more: number;
  less: number;
}

export interface ReconcileQuery {
  warehouse?: WarehouseType;
  status?: string;
  diffType?: string;
  sku?: string;
  batchId?: number;
  isGift?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

/** findAll/giftView 排序字段白名单（实体真实属性名，防 SQL 注入，P0-3）。 */
const SORT_FIELD_WHITELIST: readonly string[] = [
  'id',
  'eop_batch_id',
  'wms_batch_id',
  'sku_code',
  'warehouse',
  'is_gift',
  'eop_stock',
  'eop_actual',
  'eop_return',
  'wms_total',
  'wms_available',
  'wms_unsorted',
  'diff_value',
  'diff_value_actual',
  'diff_rate',
  'diff_type',
  'possible_cause',
  'status',
  'reconciled_at',
];

/** warehouse 角色财务口径脱敏字段（R-P1-08，P1-6）。 */
const WAREHOUSE_MASKED_FIELDS = [
  'diff_value',
  'diff_value_actual',
  'diff_rate',
] as const;

@Injectable()
export class ReconcileService {
  constructor(
    @InjectRepository(InventoryReconcile)
    private readonly reconcileRepo: Repository<InventoryReconcile>,
    private readonly inventory: InventoryService,
    private readonly products: ProductService,
    private readonly notify: NotifyService,
    private readonly alertConfig: AlertConfigService,
    private readonly operationLog: OperationLogService,
  ) {}

  /**
   * 执行对账（R-P0-07~09）。
   * - 指定 eopBatchId/wmsBatchId 时（导入自动对账）：沿用传入批次做单趟对账，保持原行为。
   * - 不指定批次时（手动「重新对账」）：按仓库维度各取「该仓库存在数据的最新批次」
   *   分别对账，避免最新批次恰好是另一仓库导致当前仓库对账为 0（P0 回归）。
   */
  async run(
    eopBatchId?: number,
    wmsBatchId?: number,
    warehouse?: WarehouseType,
  ): Promise<ReconcileSummary> {
    const tolerance = await this.alertConfig.getNumber(
      'diff_rate_tolerance',
      0.005,
    );
    const giftMap = await this.products.giftMap();
    const giftSet = new Set(
      [...giftMap.entries()].filter(([, v]) => v).map(([k]) => k),
    );

    const unsortedMap = await this.inventory.aggregateUnsortedQtyBySkuWarehouse();

    const allResults: any[] = [];
    const expiredGiftWarnings: { sku_code: string; reason: string }[] = [];
    const usedPairs: { eopId: number; wmsId: number }[] = [];

    const processPair = async (
      eopNormalId: number,
      wmsNormalId: number,
      eopGiftId: number | null,
      wmsGiftId: number | null,
      unsortedMap: Map<string, number>,
    ) => {
      usedPairs.push({ eopId: eopNormalId, wmsId: wmsNormalId });

      const eopNormalRaw = await this.inventory.getEopByBatch(eopNormalId);
      const wmsNormalRaw = await this.inventory.getWmsByBatch(wmsNormalId);
      // 正常商品：排除赠品 SKU（赠品由下方 gift 分支单独处理）
      const eopNormalRows = eopNormalRaw.filter(
        (r) => !giftSet.has(r.sku_code),
      );
      const wmsNormalRows = wmsNormalRaw.filter(
        (r) => !giftSet.has(r.sku_code),
      );

      const normalRows = reconcileNormalWarehouse({
        eopRows: eopNormalRows,
        wmsRows: wmsNormalRows,
        eopBatchId: eopNormalId,
        wmsBatchId: wmsNormalId,
        tolerance,
        isGift: false,
        unsortedMap,
      });
      const expiredNormalRows = reconcileExpiredWarehouse({
        eopRows: eopNormalRows.filter((r) => r.warehouse === 'expired'),
        wmsRows: wmsNormalRows.filter((r) => r.warehouse === 'expired'),
        eopBatchId: eopNormalId,
        wmsBatchId: wmsNormalId,
        tolerance,
        isGift: false,
        unsortedMap,
      });

      // 赠品：EOP/WMS 行均按 giftSet 提取（兼容独立赠品批次或同批次混合数据）
      let giftNormalRows: InventoryReconcile[] = [];
      let giftExpiredRows: InventoryReconcile[] = [];
      if (eopGiftId) {
        usedPairs.push({
          eopId: eopGiftId,
          wmsId: wmsGiftId ?? wmsNormalId,
        });
        const eopGiftRaw = await this.inventory.getEopByBatch(eopGiftId);
        const wmsGiftRaw: WmsInventory[] = wmsGiftId
          ? await this.inventory.getWmsByBatch(wmsGiftId)
          : wmsNormalRaw;
        const eopGiftRows = eopGiftRaw.filter((r) =>
          giftSet.has(r.sku_code),
        );
        const wmsGiftRows = wmsGiftRaw.filter((r) =>
          giftSet.has(r.sku_code),
        );
        giftNormalRows = reconcileNormalWarehouse({
          eopRows: eopGiftRows.filter((r) => r.warehouse === 'normal'),
          wmsRows: wmsGiftRows.filter((r) => r.warehouse === 'normal'),
          eopBatchId: eopGiftId,
          wmsBatchId: wmsGiftId ?? wmsNormalId,
          tolerance,
          isGift: true,
          unsortedMap,
        });
        const expEop = eopGiftRows.filter((r) => r.warehouse === 'expired');
        const expWms = wmsGiftRows.filter((r) => r.warehouse === 'expired');
        giftExpiredRows = reconcileExpiredWarehouse({
          eopRows: expEop,
          wmsRows: expWms,
          eopBatchId: eopGiftId,
          wmsBatchId: wmsGiftId ?? wmsNormalId,
          tolerance,
          isGift: true,
          unsortedMap,
        });
        for (const r of [...expEop, ...expWms]) {
          if (r.warehouse === 'expired') {
            expiredGiftWarnings.push({
              sku_code: r.sku_code,
              reason: '临期仓出现赠品',
            });
          }
        }
      }

      allResults.push(
        ...normalRows.filter((r) => r.warehouse === 'normal'),
        ...expiredNormalRows,
        ...giftNormalRows,
        ...giftExpiredRows,
      );
    };

    if (eopBatchId || wmsBatchId) {
      // 显式批次（导入自动对账）：保持原单趟行为，避免污染另一仓库数据。
      const eopId = eopBatchId ?? (await this.inventory.getLatestBatch('eop'));
      const wmsId = wmsBatchId ?? (await this.inventory.getLatestBatch('wms'));
      if (!eopId || !wmsId) {
        return { total: 0, match: 0, diff: 0, more: 0, less: 0 };
      }
      // 显式批次：正常/赠品共用同一批次对，行内按 giftSet 拆分
      await processPair(eopId, wmsId, eopId, wmsId, unsortedMap);
    } else {
      // 手动对账：按仓库各取最新批次，分别对账。
      const warehouses: WarehouseType[] = warehouse
        ? [warehouse]
        : ['normal', 'expired'];
      for (const wh of warehouses) {
        // 未分拣量必须按仓库过滤：unsortedMap 是全量（normal+expired 都有），
        // 直接全量叠加会把另一仓库的未分拣 SKU 混入本仓库对账，
        // 导致批次对错乱、行误标仓库（如 expired 对账把正常仓未分拣 SKU 写成 normal）。
        const whUnsortedMap = new Map<string, number>();
        for (const [k, v] of unsortedMap) {
          if (k.endsWith(`|${wh}`)) whUnsortedMap.set(k, v);
        }
        // 正常商品：取 is_gift=false 的最新批次（避免赠品文件覆盖正常商品基准）
        const eopNormalId = await this.inventory.getLatestBatchForWarehouse(
          'eop',
          wh,
          false,
        );
        const wmsNormalId = await this.inventory.getLatestBatchForWarehouse(
          'wms',
          wh,
          false,
        );
        // 赠品：取 is_gift=true 的专用批次（无则回退到正常批次，行内按 giftSet 提取）
        const eopGiftId = await this.inventory.getLatestBatchForWarehouse(
          'eop',
          wh,
          true,
        );
        const wmsGiftId = await this.inventory.getLatestBatchForWarehouse(
          'wms',
          wh,
          true,
        );
        if (!eopNormalId || !wmsNormalId) continue;
        // 重新对账前清除该仓库旧结果，避免历史批次对行残留导致同一 (sku,warehouse) 多行、统计失真。
        await this.reconcileRepo
          .createQueryBuilder()
          .delete()
          .from(InventoryReconcile)
          .where('warehouse = :w', { w: wh })
          .execute();
        await processPair(
          eopNormalId,
          wmsNormalId,
          eopGiftId,
          wmsGiftId,
          whUnsortedMap,
        );
      }
    }

    // 幂等 upsert：唯一键 (sku_code, warehouse, eop_batch_id, wms_batch_id)
    // 冲突时更新数据列，避免重复对账触发唯一键冲突 500（P1-4）。
    // 分块写入：PostgreSQL 单条语句参数上限 65535，对账行 × 列数易超上限，
    // 触发 node-postgres "bind message has N parameter formats but 0 parameters"。
    // 每块 1000 行（约 19000 参数）远低于上限，避免整条导入因对账步骤 500。
    if (allResults.length > 0) {
      const UPDATE_COLS = [
        'is_gift',
        'sku_name',
        'eop_stock',
        'eop_actual',
        'eop_return',
        'wms_total',
        'wms_available',
        'wms_unsorted',
        'diff_value',
        'diff_value_actual',
        'diff_rate',
        'diff_type',
        'possible_cause',
        'status',
      ];
      const CONFLICT_TARGET = [
        'sku_code',
        'warehouse',
        'eop_batch_id',
        'wms_batch_id',
      ];
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < allResults.length; i += CHUNK_SIZE) {
        const chunk = allResults.slice(i, i + CHUNK_SIZE);
        await this.reconcileRepo
          .createQueryBuilder()
          .insert()
          .into(InventoryReconcile)
          .values(chunk)
          .orUpdate(UPDATE_COLS, CONFLICT_TARGET)
          .execute();
      }
    }

    // 生成差异通知（幂等：按 type+related_id / type+title+message 去重，P1-4）
    for (const row of allResults) {
      if (row.status !== 'match') {
        await this.notify.createIfAbsent({
          type: 'diff',
          title: `库存差异：${row.sku_code}`,
          message: `${row.warehouse === 'normal' ? '正常仓' : '临期仓'} SKU ${row.sku_code} 状态 ${row.status}，差异值 ${row.diff_value}，可能原因：${row.possible_cause}`,
          relatedId: row.id,
        });
      }
    }

    // 临期赠品告警
    for (const warn of expiredGiftWarnings) {
      await this.notify.createIfAbsent({
        type: 'expired_gift',
        title: '临期仓赠品告警',
        message: `SKU ${warn.sku_code} 出现在临期仓：${warn.reason}`,
      });
    }

    await this.operationLog.log(
      'reconcile',
      `对账批次 ${usedPairs
        .map((p) => `EOP#${p.eopId}/WMS#${p.wmsId}`)
        .join(' , ')}`,
      { total: allResults.length },
    );

    return {
      total: allResults.length,
      match: allResults.filter((r) => r.status === 'match').length,
      diff: allResults.filter((r) => r.status === 'diff').length,
      more: allResults.filter((r) => r.diffType === 'more').length,
      less: allResults.filter((r) => r.diffType === 'less').length,
    };
  }

  async findAll(query: ReconcileQuery, role?: string) {
    const { page, size } = normalizePage(query.page, query.size);
    const qb = this.reconcileRepo.createQueryBuilder('r');

    if (query.warehouse) {
      qb.where('r.warehouse = :w', { w: query.warehouse });
    }
    if (query.status) {
      qb.andWhere('r.status = :s', { s: query.status });
    }
    if (query.diffType) {
      qb.andWhere('r.diff_type = :d', { d: query.diffType });
    }
    if (query.sku) {
      qb.andWhere('r.sku_code LIKE :sku', { sku: `%${query.sku}%` });
    }
    if (query.batchId) {
      qb.andWhere('(r.eop_batch_id = :bid OR r.wms_batch_id = :bid)', {
        bid: query.batchId,
      });
    }
    if (query.isGift !== undefined) {
      qb.andWhere('r.is_gift = :g', { g: query.isGift });
    }

    // 排序字段白名单校验：不在白名单则回落默认排序，防 SQL 注入（P0-3）
    if (query.sort) {
      const [field, order] = query.sort.split(',');
      const dir = order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      if (SORT_FIELD_WHITELIST.includes(field)) {
        qb.orderBy(`r.${field}`, dir);
      } else {
        qb.orderBy('r.reconciled_at', 'DESC');
      }
    } else {
      qb.orderBy('r.reconciled_at', 'DESC');
    }

    if (size !== null) qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items: this.maskForWarehouse(items, role), total };
  }

  async findOne(id: number, role?: string) {
    const row = await this.reconcileRepo.findOne({ where: { id } });
    if (!row) return null;
    return role === 'warehouse'
      ? this.maskForWarehouse([row], role)[0]
      : row;
  }

  async getLatestSummary(warehouse?: WarehouseType) {
    const qb = this.reconcileRepo.createQueryBuilder('r');
    if (warehouse) {
      qb.where('r.warehouse = :w', { w: warehouse });
    }
    const [items, total] = await qb.getManyAndCount();
    const diffSku = items.filter((r) => r.status !== 'match').length;
    const diffRate = total === 0 ? 0 : diffSku / total;
    return { total, diffSku, diffRate };
  }

  /**
   * 对账报告聚合数据（仅当前仓库最新一次对账结果，BR-06~13）。
   * 返回整体统计卡片 + 差异明细 Top N（按差异值绝对值降序）。
   */
  async getReport(warehouse?: WarehouseType) {
    const qb = this.reconcileRepo.createQueryBuilder('r');
    if (warehouse) {
      qb.where('r.warehouse = :w', { w: warehouse });
    }
    // 整体统计
    const statsQb = qb.clone();
    const rows = await statsQb.getMany();
    const total = rows.length;
    const match = rows.filter((r) => r.status === 'match').length;
    const more = rows.filter((r) => (r as any).diff_type === 'more').length;
    const less = rows.filter((r) => (r as any).diff_type === 'less').length;
    const matchRate = total === 0 ? 0 : Math.round((match / total) * 100);
    // 批次溯源：取最近一次对账使用的 EOP/WMS 批次
    const batchQb = this.reconcileRepo.createQueryBuilder('r')
      .select('MAX(r.eop_batch_id)', 'eopBatchId')
      .addSelect('MAX(r.wms_batch_id)', 'wmsBatchId');
    if (warehouse) batchQb.where('r.warehouse = :w', { w: warehouse });
    const batchRaw = await batchQb.getRawOne();
    const batchId = batchRaw?.eopbatchid ?? batchRaw?.eopBatchId ?? null;
    // 差异明细 Top 20（按 diff_value 绝对值降序）
    const detailQb = this.reconcileRepo.createQueryBuilder('r')
      .select([
        'r.sku_code',
        'r.sku_name',
        'r.is_gift',
        'r.diff_value',
        'r.diff_value_actual',
        'r.diff_type',
        'r.possible_cause',
        'r.reconciled_at',
      ])
      .orderBy('ABS(r.diff_value)', 'DESC')
      .limit(20);
    if (warehouse) detailQb.where('r.warehouse = :w', { w: warehouse });
    const detail = await detailQb.getMany();
    return { total, match, more, less, matchRate, batchId, detail };
  }

  /**
   * 赠品视角的对账结果列表（is_gift = true）。
   */
  async giftView(query: ReconcileQuery, role?: string) {
    const { page, size } = normalizePage(query.page, query.size);
    const qb = this.reconcileRepo.createQueryBuilder('r');
    qb.where('r.is_gift = :g', { g: true });
    if (query.warehouse) {
      qb.andWhere('r.warehouse = :w', { w: query.warehouse });
    }
    if (query.status) {
      qb.andWhere('r.status = :s', { s: query.status });
    }
    if (query.diffType) {
      qb.andWhere('r.diff_type = :d', { d: query.diffType });
    }
    if (query.sku) {
      qb.andWhere('r.sku_code LIKE :sku', { sku: `%${query.sku}%` });
    }
    if (query.batchId) {
      qb.andWhere('(r.eop_batch_id = :bid OR r.wms_batch_id = :bid)', {
        bid: query.batchId,
      });
    }
    qb.orderBy('r.reconciled_at', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items: this.maskForWarehouse(items, role), total };
  }

  /**
   * 导出对账结果为 Excel（Buffer）。由控制器设置响应头后直接透传二进制。
   */
  async exportReconcile(query: ReconcileQuery, role?: string): Promise<Buffer> {
    const { items } = await this.findAll(
      { ...query, page: 1, size: 5000 },
      role,
    );
    const rows = items.map((r) => ({
      SKU编码: r.sku_code,
      仓库: r.warehouse === 'normal' ? '正常仓' : '临期仓',
      是否赠品: r.is_gift ? '是' : '否',
      EOP账面库存: r.eop_stock,
      EOP实物库存: r.eop_actual,
      EOP退货在途: r.eop_return,
      WMS总库存: r.wms_total,
      WMS可用库存: r.wms_available,
      WMS未分拣: r.wms_unsorted,
      差异值: r.diff_value,
      退货比对:
        Number(r.eop_return || 0) > 0 && Number(r.diff_value || 0) > 0
          ? Number(r.diff_value) - Number(r.eop_return)
          : '',
      实际差异: r.diff_value_actual,
      差异率: r.diff_rate,
      差异类型: r.diff_type,
      可能原因: r.possible_cause || '',
      对账状态: r.status,
      对账时间: r.reconciled_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'reconcile');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * 清除对账引用（供库存行删除/切仓前解除约束）。仅标记 cleared=true，
   * 保留对账审计记录；isReferencedByReconcile 会忽略已清除记录。
   */
  async clearReference(id: number) {
    const rec = await this.reconcileRepo.findOne({ where: { id } });
    if (!rec) throw new NotFoundException('对账记录不存在');
    rec.cleared = true;
    await this.reconcileRepo.save(rec);
    return { id, cleared: true };
  }

  /**
   * 清空全部对账数据（一键清空）。返回删除的行数。
   * 仅删除对账记录本身；库存快照数据不受影响。
   */
  async clearAll(warehouse?: WarehouseType): Promise<{ deleted: number }> {
    const qb = this.reconcileRepo.createQueryBuilder('r').delete();
    if (warehouse) qb.where('warehouse = :w', { w: warehouse });
    const result = await qb.execute();
    return { deleted: result.affected || 0 };
  }

  /**
   * warehouse 角色财务口径脱敏（R-P1-08）：
   * 将差异金额/差异率字段置 null（操作口径的 sku/状态/类型仍保留）。
   */
  private maskForWarehouse<T>(items: T[], role?: string): T[] {
    if (role !== 'warehouse') return items;
    return items.map((r) => {
      const o = { ...(r as Record<string, unknown>) };
      for (const f of WAREHOUSE_MASKED_FIELDS) o[f] = null;
      return o as unknown as T;
    });
  }
}
