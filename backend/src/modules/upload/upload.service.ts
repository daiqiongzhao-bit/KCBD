import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { Product } from '../inventory/entities/product.entity';
import { UploadBatch } from '../inventory/entities/upload-batch.entity';
import { GiftSku } from '../inventory/entities/gift-sku.entity';
import { EopInventory } from '../inventory/entities/eop-inventory.entity';
import { WmsInventory } from '../inventory/entities/wms-inventory.entity';
import { WmsUnsortedOrder } from '../inventory/entities/wms-unsorted-order.entity';
import { InventoryService, WmsRowInput } from '../inventory/inventory.service';
import { ProductService } from '../inventory/product.service';
import { FieldMappingService } from './field-mapping.service';
import { parseExcelBuffer } from './parsers/excel.parser';
import { RowValidator } from './validation/row-validator';
import { SourceType, WarehouseType } from '../../common/constants/types';
import { OperationLogService } from '../dashboard/operation-log.service';

export interface PreviewResult {
  headers: string[];
  suggestedMapping: Record<string, string>;
  previewRows: Record<string, string>[];
  issues: { row: number; field: string; reason: string }[];
}

export interface ImportResult {
  idempotent: boolean;
  batch: UploadBatch;
  rowsValid: number;
  rowsInvalid: number;
  issueCount: number;
  reconcileSummary: { total: number; match: number; diff: number; more: number; less: number } | null;
}

@Injectable()
export class UploadService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly products: ProductService,
    private readonly mapping: FieldMappingService,
    private readonly operationLog: OperationLogService,
  ) {}

  /**
   * 还原 multer 因 latin1 错编码导致双重编码的中文文件名。
   * 历史原因：旧版本 multer 未配 defParamCharset='utf8'，DB 中存的是乱码字符串。
   * 策略：尝试双重反转（latin1 字节 → utf8 字符串），如还原出可读中文则使用，否则保持原值。
   */
  private fixMulterFilename(raw: string | null | undefined): string {
    if (!raw) return '';
    try {
      const candidate = Buffer.from(raw, 'latin1').toString('utf8');
      // 还原成功判断：不含 Unicode 替换字符且包含至少一个中文字符
      const looksLikeChinese = /[\u4e00-\u9fa5]/.test(candidate);
      if (looksLikeChinese && !candidate.includes('\uFFFD')) return candidate;
      return raw;
    } catch {
      return raw;
    }
  }

  /** 检测是否为 PG unique violation（23505），用于幂等兜底。 */
  private isDuplicateError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as { code?: string; driverError?: { code?: string } };
    return err.code === '23505' || err.driverError?.code === '23505';
  }

  /**
   * 判断一个批次是否已无业务数据（孤儿批次）。
   * 用于单表清空后重新导入同文件时自动释放 content_hash。
   */
  private async isBatchOrphan(
    source: SourceType,
    batchId: number,
  ): Promise<boolean> {
    if (source === 'eop') {
      return (await this.dataSource.manager.countBy(EopInventory, { batch_id: batchId })) === 0;
    }
    if (source === 'wms') {
      return (await this.dataSource.manager.countBy(WmsInventory, { batch_id: batchId })) === 0;
    }
    if (source === 'unsorted') {
      return (await this.dataSource.manager.countBy(WmsUnsortedOrder, { batch_id: batchId })) === 0;
    }
    if (source === 'gift') {
      // gift_skus 没有 batch_id，只能用整表是否为空判断（清空 gift_skus 会同步清 upload_batches）
      return (await this.dataSource.manager.countBy(GiftSku, {})) === 0;
    }
    return false;
  }

  /** 预览：解析 + 推断映射 + 前 50 行校验（不落库）。warehouse 来自导入页选择器。 */
  preview(
    file: { buffer: Buffer },
    source: SourceType,
    warehouse?: WarehouseType | null,
  ): PreviewResult {
    const { headers, rows } = parseExcelBuffer(file.buffer);
    const suggestedMapping = this.mapping.suggestMapping(headers, source);
    const sample = rows.slice(0, 50);
    const { issues } = RowValidator.validate(sample, suggestedMapping, source, warehouse);
    return {
      headers,
      suggestedMapping,
      previewRows: sample,
      issues,
    };
  }

  /** 确认导入：完整校验 → 事务入库 → 触发对账。 */
  async import(
    file: { buffer: Buffer; originalname?: string },
    source: SourceType,
    mapping: Record<string, string>,
    options: {
      force?: boolean;
      batchName?: string;
      uploaderId?: number;
      warehouse?: WarehouseType | null;
      isGift?: boolean;
    } = {},
  ): Promise<ImportResult> {
    const buffer = file.buffer;
    const contentHash = createHash('sha256').update(buffer).digest('hex');

    if (!options.force) {
      const existing = await this.inventory.findExistingBatch(source, contentHash);
      if (existing) {
        // 2026-08-23 修正：如果旧批次是孤儿（其库存行已被单表清空等操作删除），
        // 则删除该批次记录并继续导入，避免"已清空却重新导入失败"的困惑。
        const isOrphan = await this.isBatchOrphan(source, existing.id);
        if (isOrphan) {
          await this.dataSource.transaction(async (manager) => {
            await manager.remove(UploadBatch, existing);
          });
        } else {
          return {
            idempotent: true,
            batch: existing,
            rowsValid: existing.rows_valid,
            rowsInvalid: existing.rows_invalid,
            issueCount: 0,
            reconcileSummary: null,
          };
        }
      }
    } else {
      // 强制覆盖：先删同 content_hash 的旧 batch 记录（解除唯一约束）及其库存/对账行，
      // 否则新 batch insert 时撞 content_hash 唯一约束会 23505，被 catch 兜底返回 idempotent，
      // 表面"已跳过"实际旧数据被 clearPriorInventory 删了但新数据没插上 → 数据丢失。
      await this.replaceOldBatchesForForce(source, contentHash);
    }

    const { headers, rows } = parseExcelBuffer(buffer);
    // mapping 未提供/为空时自动推断（与预览一致），保证接口自足
    const effectiveMapping =
      mapping && Object.keys(mapping).length > 0
        ? mapping
        : this.mapping.suggestMapping(headers, source);
    // 仓库类型：优先模板列，否则采用导入页选择器传入的 warehouse
    const warehouse =
      (options.warehouse as WarehouseType | undefined) ?? undefined;
    // 赠品标记：显式参数优先；否则按文件名含「赠品」自动识别
    const isGift =
      options.isGift ?? /赠品/.test(file.originalname || '');

    const { valid, issues } = RowValidator.validate(
      rows, effectiveMapping, source, warehouse, headers,
    );

    const batch = this.dataSource.manager.create(UploadBatch, {
      source,
      file_name: this.fixMulterFilename(file.originalname) || null,
      content_hash: contentHash,
      uploader_id: options.uploaderId ?? null,
      batch_name: options.batchName || null,
      row_count: rows.length,
      rows_valid: valid.length,
      rows_invalid: issues.length,
      status: valid.length > 0 ? 'success' : 'failed',
      is_gift: isGift,
      error_summary: issues.length > 0 ? { issues: issues.slice(0, 200) } : null,
    });

    // 强制覆盖：清空同 source + warehouse 的历史库存（"覆盖"的字面语义）
    // - 同一 source + warehouse 视为同一个数据源，旧批次的数据应被新批次完全替换
    // - 不勾选时不清空，正常累加（幂等检查由 content_hash 兜底）
    if (options.force) {
      await this.dataSource.transaction(async (manager) => {
        await this.clearPriorInventory(manager, source, warehouse as any);
      });
    }

    try {
    await this.dataSource.transaction(async (manager) => {
      const savedBatch = await manager.save(batch);
      batch.id = savedBatch.id;

      const productRepo = manager.getRepository(Product);
      const wmsRepo = manager.getRepository(WmsInventory);
      const eopRepo = manager.getRepository(EopInventory);

      const upsertProduct = async (
        sku: string,
        name: string,
        gift = false,
        barcode?: string,
      ) => {
        let p = await productRepo.findOne({ where: { sku_code: sku } });
        if (!p) p = productRepo.create({ sku_code: sku });
        if (name) p.sku_name = name;
        if (barcode) p.barcode = barcode;
        if (gift) p.is_gift = true;
        await productRepo.save(p);
      };

      if (source === 'eop') {
        const entities = valid.map((r: any) =>
          eopRepo.create(
            this.truncateRow(eopRepo, {
              batch_id: batch.id,
              sku_code: r.sku_code,
              warehouse: r.warehouse,
              stock_qty: r.stock_qty,
              actual_qty: r.actual_qty,
              return_qty: r.return_qty,
              ...(r.extras as Record<string, any>),
            } as any),
          ),
        );
        await eopRepo.save(entities as any, { chunk: 1000 });
        for (const r of valid)
          await upsertProduct(
            r.sku_code,
            r.sku_name,
            isGift,
            (r as any).extras?.barcode ?? undefined,
          );
      } else if (source === 'wms' || source === 'unsorted') {
        if (source === 'unsorted' || this.mapping.isUnsortedTemplate(headers)) {
          // 未分拣出库单行：原样入库 + 按货品编码聚合为未分拣量
          // unsorted 类型必须传 warehouse（区分正常/临期仓）
          if (source === 'unsorted' && !warehouse) {
            throw new BadRequestException('未分拣报表必须指定仓库类型（正常/临期）');
          }
          const wh = warehouse ?? (valid[0] as any)?.warehouse;
          await this.saveUnsortedOrders(manager, batch.id, wh, effectiveMapping, rows);
          const agg = this.aggregateUnsorted(valid as any[]);
          // source='unsorted' 时不写 wms_inventory 快照（只入未分拣表，由导入页仓库类型决定）
          if (source === 'wms') {
            const wmsRows: WmsRowInput[] = agg.map((a) =>
              this.truncateRow(wmsRepo, {
                batch_id: batch.id,
                sku_code: a.sku_code,
                warehouse: a.warehouse,
                stock_qty: a.unsorted_qty,
                available_qty: 0,
                unsorted_qty: a.unsorted_qty,
              } as WmsRowInput),
            );
            await wmsRepo.save(
              wmsRows.map((w) => wmsRepo.create(w)),
              { chunk: 1000 },
            );
          }
          for (const a of agg) await upsertProduct(a.sku_code, a.sku_name, false);
        } else {
          const wmsRows: WmsRowInput[] = (valid as any[]).map((r) =>
            this.truncateRow(wmsRepo, {
              batch_id: batch.id,
              sku_code: r.sku_code,
              warehouse: r.warehouse,
              stock_qty: r.stock_qty,
              available_qty: r.stock_qty - r.unsorted_qty,
              unsorted_qty: r.unsorted_qty,
              ...(r.extras as Record<string, any>),
            } as WmsRowInput),
          );
          await wmsRepo.save(
            wmsRows.map((w) => wmsRepo.create(w)),
            { chunk: 1000 },
          );
          for (const r of valid) {
            // WMS 库存的 inventorySts=ZSP 视为赠品、ZP 视为正品，自动标记 Product.is_gift
            const sts = ((r as any).extras?.inventory_sts
              ?? (r as any).extras?.inventorySts
              ?? '') as string;
            const isGift = sts.toUpperCase() === 'ZSP';
            await upsertProduct(
              r.sku_code,
              (r as any).extras?.sku_name ?? r.sku_name,
              isGift,
            );
          }
        }
      } else {
        const giftRepo = manager.getRepository(GiftSku);
        for (const r of valid) {
          const exists = await giftRepo.findOne({ where: { sku_code: r.sku_code } });
          if (!exists) {
            await giftRepo.save(
              giftRepo.create({
                sku_code: r.sku_code,
                effective_date: (r as any).effective_date || null,
              }),
            );
          }
          await upsertProduct(r.sku_code, r.sku_name, true);
        }
      }
    });
  } catch (e) {
    // 并发幂等保护：force=true 时跳过预检查，事务内 save upload_batches 可能撞唯一约束
    if (this.isDuplicateError(e)) {
      const existing = await this.inventory.findExistingBatch(source, contentHash);
      if (existing) {
        return {
          idempotent: true,
          batch: existing,
          rowsValid: existing.rows_valid,
          rowsInvalid: existing.rows_invalid,
          issueCount: 0,
          reconcileSummary: null,
        };
      }
    }
    throw e;
  }

  await this.operationLog.log(
    'import',
    `${source} 批次#${batch.id}`,
    { rowsValid: valid.length, rowsInvalid: issues.length, file: this.fixMulterFilename(file.originalname) },
    options.uploaderId,
  );

    // 2026-08-23 调整：导入成功后不再自动对账，由用户在「库存对账」页手动执行，
    // 避免大批量导入时因对账耗时/失败影响导入体验，也更符合「导入是导入、对账是对账」的语义。
    return {
      idempotent: false,
      batch,
      rowsValid: valid.length,
      rowsInvalid: issues.length,
      issueCount: issues.length,
      reconcileSummary: null,
    };
  }

  /**
   * 按实体列定义长度截断超长字符串（防御 PostgreSQL 22001 / value too long，
   * 真实 EOP/WMS 模板中的长文本列可能超过列长限制）。
   */
  private truncateRow<T extends object>(
    repo: { metadata: { columns: Array<{ propertyName: string; length?: string | number }> } },
    row: T,
  ): T {
    for (const col of repo.metadata.columns) {
      const v = (row as Record<string, unknown>)[col.propertyName];
      const len = col.length == null ? 0 : Number(col.length);
      if (typeof v === 'string' && len > 0 && v.length > len) {
        (row as Record<string, unknown>)[col.propertyName] = v.slice(0, len);
      }
    }
    return row;
  }

  /** 原样保存未分拣出库单行（字段按真实模板表头提取）。 */
  private async saveUnsortedOrders(
    manager: any,
    batchId: number,
    warehouse: WarehouseType,
    mapping: Record<string, string>,
    rows: Record<string, string>[],
  ): Promise<void> {
    const repo = manager.getRepository(WmsUnsortedOrder);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const find = (...candidates: string[]): string | undefined => {
      const lower = headers.map((h) => h.toLowerCase());
      for (const c of candidates) {
        const idx = lower.findIndex((h) => h.includes(c.toLowerCase()));
        if (idx >= 0) return headers[idx];
      }
      return undefined;
    };
    const col = {
      order_no: find('出库单号'),
      order_type: find('出库单类型'),
      carrier_code: find('承运人编码'),
      express_no: find('快递单号'),
      wave_no: find('波次号'),
      recipient: find('收件人'),
      province: find('省'),
      city: find('市'),
      district: find('区'),
      address: find('地址'),
      id_card: find('身份证号'),
      fail_reason: find('失败原因'),
      created_at: find('创建时间'),
    };
    const entities = rows
      .map((r) =>
        repo.create(
          this.truncateRow(repo, {
            batch_id: batchId,
            warehouse,
            order_no: col.order_no ? r[col.order_no] ?? '' : '',
            order_type: col.order_type ? r[col.order_type] ?? '' : '',
            carrier_code: col.carrier_code ? r[col.carrier_code] ?? '' : '',
            express_no: col.express_no ? r[col.express_no] ?? '' : '',
            wave_no: col.wave_no ? r[col.wave_no] ?? '' : '',
            sku_code: mapping.sku_code ? r[mapping.sku_code] ?? '' : '',
            sku_name: mapping.sku_name ? r[mapping.sku_name] ?? '' : '',
            qty: Number((mapping.unsorted_qty ? r[mapping.unsorted_qty] : '') || 0) || 0,
            recipient: col.recipient ? r[col.recipient] ?? '' : '',
            province: col.province ? r[col.province] ?? '' : '',
            city: col.city ? r[col.city] ?? '' : '',
            district: col.district ? r[col.district] ?? '' : '',
            address: col.address ? r[col.address] ?? '' : '',
            id_card: col.id_card ? r[col.id_card] ?? '' : '',
            fail_reason: col.fail_reason ? r[col.fail_reason] ?? '' : '',
            created_at: col.created_at ? r[col.created_at] ?? '' : '',
          } as any),
        ),
      )
      .filter((e) => e.sku_code);
    await repo.save(entities, { chunk: 1000 });
  }

  /** 将未分拣逐行校验结果按货品编码聚合为未分拣量。 */
  private aggregateUnsorted(
    rows: { sku_code: string; sku_name: string; warehouse: WarehouseType; unsorted_qty: number }[],
  ): { sku_code: string; sku_name: string; warehouse: WarehouseType; unsorted_qty: number }[] {
    const map = new Map<string, { sku_code: string; sku_name: string; warehouse: WarehouseType; unsorted_qty: number }>();
    for (const r of rows) {
      const key = r.sku_code;
      const cur = map.get(key) || {
        sku_code: r.sku_code,
        sku_name: r.sku_name,
        warehouse: r.warehouse,
        unsorted_qty: 0,
      };
      cur.unsorted_qty += r.unsorted_qty || 0;
      map.set(key, cur);
    }
    return [...map.values()];
  }

  async listBatches(query: { source?: SourceType; page?: number; size?: number }) {
    return this.inventory.listBatches(query);
  }

  async getBatch(id: number) {
    const batch = await this.inventory.getBatch(id);
    if (!batch) throw new BadRequestException('批次不存在');
    return batch;
  }

  /**
   * 强制覆盖：删除同 (source, content_hash) 的所有旧 upload_batches 记录及其库存/对账行。
   * 目的：解除 content_hash 唯一约束、彻底替换旧数据。
   */
  private async replaceOldBatchesForForce(
    source: SourceType,
    contentHash: string,
  ): Promise<void> {
    const olds = await this.dataSource.manager
      .getRepository(UploadBatch)
      .createQueryBuilder('b')
      .select('b.id', 'id')
      .where('b.source = :s', { s: source })
      .andWhere('b.content_hash = :h', { h: contentHash })
      .getRawMany<{ id: number }>();
    if (olds.length === 0) return;
    const ids = olds.map((o) => o.id);
    await this.dataSource.transaction(async (manager) => {
      if (source === 'eop') {
        await manager
          .createQueryBuilder()
          .delete()
          .from(EopInventory)
          .where('batch_id IN (:...ids)', { ids })
          .execute();
      } else if (source === 'wms') {
        await manager
          .createQueryBuilder()
          .delete()
          .from(WmsInventory)
          .where('batch_id IN (:...ids)', { ids })
          .execute();
        await manager
          .createQueryBuilder()
          .delete()
          .from(WmsUnsortedOrder)
          .where('batch_id IN (:...ids)', { ids })
          .execute();
      } else if (source === 'unsorted') {
        await manager
          .createQueryBuilder()
          .delete()
          .from(WmsUnsortedOrder)
          .where('batch_id IN (:...ids)', { ids })
          .execute();
      } else if (source === 'gift') {
        await manager
          .createQueryBuilder()
          .delete()
          .from(GiftSku)
          .where('batch_id IN (:...ids)', { ids })
          .execute();
      }
      await manager
        .createQueryBuilder()
        .delete()
        .from('inventory_reconcile')
        .where('eop_batch_id IN (:...ids) OR wms_batch_id IN (:...ids)', { ids })
        .execute();
      // 最后删旧 batch 行（解除 content_hash 唯一约束）
      await manager.getRepository(UploadBatch).delete(ids);
    });
  }

  /**
   * 强制覆盖语义：清空同 source + warehouse 的历史库存行。
   * - 同 source + warehouse 视为同一个数据源，旧批次数据应被新批次完全替换
   * - 不删 upload_batches 行（保留审计），只清库存行 + 对账行
   * - gift 源不分仓库，仅按 source 清空 gift_skus
   */
  private async clearPriorInventory(
    manager: import('typeorm').EntityManager,
    source: SourceType,
    warehouse: WarehouseType | null | undefined,
  ): Promise<void> {
    if (source === 'eop') {
      const qb = manager
        .createQueryBuilder()
        .delete()
        .from(EopInventory);
      if (warehouse) qb.where('warehouse = :wh', { wh: warehouse });
      else qb.where('1 = 1');
      await qb.execute();
    } else if (source === 'wms') {
      const qb = manager
        .createQueryBuilder()
        .delete()
        .from(WmsInventory);
      if (warehouse) qb.where('warehouse = :wh', { wh: warehouse });
      else qb.where('1 = 1');
      await qb.execute();
      // 未分拣报表走 wms 源
      const uq = manager
        .createQueryBuilder()
        .delete()
        .from(WmsUnsortedOrder);
      if (warehouse) uq.where('warehouse = :wh', { wh: warehouse });
      else uq.where('1 = 1');
      await uq.execute();
    } else if (source === 'unsorted') {
      const uq = manager
        .createQueryBuilder()
        .delete()
        .from(WmsUnsortedOrder);
      if (warehouse) uq.where('warehouse = :wh', { wh: warehouse });
      else uq.where('1 = 1');
      await uq.execute();
    } else if (source === 'gift') {
      await manager.createQueryBuilder().delete().from(GiftSku).execute();
    }
    // 对账表清空：旧批次对账结果已无意义（依赖已删除的库存行）
    await manager
      .createQueryBuilder()
      .delete()
      .from('inventory_reconcile')
      .execute();
  }
}
