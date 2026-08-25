import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EopInventory } from '../inventory/entities/eop-inventory.entity';
import { WmsInventory } from '../inventory/entities/wms-inventory.entity';
import { InventoryReconcile } from '../reconcile/entities/inventory-reconcile.entity';
import { GiftSku } from '../inventory/entities/gift-sku.entity';
import { Product } from '../inventory/entities/product.entity';
import { WmsUnsortedOrder } from '../inventory/entities/wms-unsorted-order.entity';
import { InventoryService } from '../inventory/inventory.service';
import { AlertConfigService } from './alert-config.service';
import { WarehouseType, SourceType } from '../../common/constants/types';

export interface DashboardSummary {
  totalSku: number;
  eopStock: number;
  wmsStock: number;
  diffSku: number;
  giftSku: number;
  productSku: number;
  unsortedQty: number;
  expiryAlert: number;
  diffRate: number | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(EopInventory)
    private readonly eopRepo: Repository<EopInventory>,
    @InjectRepository(WmsInventory)
    private readonly wmsRepo: Repository<WmsInventory>,
    @InjectRepository(InventoryReconcile)
    private readonly reconcileRepo: Repository<InventoryReconcile>,
    @InjectRepository(GiftSku)
    private readonly giftRepo: Repository<GiftSku>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(WmsUnsortedOrder)
    private readonly unsortedOrderRepo: Repository<WmsUnsortedOrder>,
    private readonly inventory: InventoryService,
    private readonly alert: AlertConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /** 统计卡片（R-P0-11）。warehouse 角色对财务口径 diffRate 脱敏（R-P1-08）。 */
  async summary(
    warehouse?: WarehouseType,
    role?: string,
  ): Promise<DashboardSummary> {
    const eopBatchId = await this.inventory.getLatestBatch('eop');
    const wmsBatchId = await this.inventory.getLatestBatch('wms');

    // 总预览扩展指标：赠品数 / 商品主档 SKU 数
    // 赠品 SKU：WMS 导入按 inventorySts=ZSP 自动标记 products.is_gift=true；查 products 而非 gift_skus
    const giftSku = await this.productRepo
      .createQueryBuilder('p')
      .where('p.is_gift = :g', { g: true })
      .getCount();
    // 商品 SKU：排除赠品后的主档数量
    const productSku = await this.productRepo
      .createQueryBuilder('p')
      .where('p.is_gift = :g', { g: false })
      .getCount();
    // SKU 总数 = 商品 SKU + 赠品 SKU（与仪表盘「商品 SKU / 赠品 SKU」语义一致）
    const totalSku = productSku + giftSku;

    if (!eopBatchId || !wmsBatchId) {
      return {
        totalSku,
        eopStock: 0,
        wmsStock: 0,
        diffSku: 0,
        giftSku,
        productSku,
        unsortedQty: 0,
        expiryAlert: 0,
        diffRate: 0,
      };
    }
    const base = { eop_batch_id: eopBatchId, wms_batch_id: wmsBatchId } as Record<string, unknown>;
    if (warehouse) base.warehouse = warehouse;

    const reconcileTotal = await this.reconcileRepo.count({ where: base });
    const diffSku = await this.reconcileRepo
      .createQueryBuilder('r')
      .where('r.eop_batch_id = :e', { e: eopBatchId })
      .andWhere('r.wms_batch_id = :w', { w: wmsBatchId })
      .andWhere(warehouse ? 'r.warehouse = :wh' : '1=1', { wh: warehouse })
      .andWhere("r.status != 'match'")
      .getCount();

    const eopQb = this.eopRepo
      .createQueryBuilder('e')
      .where('e.batch_id = :b', { b: eopBatchId });
    if (warehouse) eopQb.andWhere('e.warehouse = :wh', { wh: warehouse });
    eopQb.select('SUM(e.stock_qty)', 's');
    const eopStock = Number((await eopQb.getRawOne()).s) || 0;

    const wmsQb = this.wmsRepo
      .createQueryBuilder('w')
      .where('w.batch_id = :b', { b: wmsBatchId });
    if (warehouse) wmsQb.andWhere('w.warehouse = :wh', { wh: warehouse });
    wmsQb.select('SUM(w.stock_qty)', 's');
    let wmsStock = Number((await wmsQb.getRawOne()).s) || 0;
    if (wmsStock === 0) {
      // 兼容 WMS 走未分拣路径（数据在 wms_unsorted_order 而非 wms_inventory）：取未分拣订单合计
      const uQb = this.unsortedOrderRepo
        .createQueryBuilder('u')
        .select('SUM(u.qty)', 's')
        .where('u.batch_id = :b', { b: wmsBatchId });
      if (warehouse) uQb.andWhere('u.warehouse = :wh', { wh: warehouse });
      const uQty = Number((await uQb.getRawOne()).s) || 0;
      if (uQty > 0) wmsStock = uQty;
    }

    // 差异率仍按「对账行总数」口径计算，避免分母变成商品主档总数后失真
    const diffRate = reconcileTotal > 0 ? diffSku / reconcileTotal : 0;

    // 未分拣量：未分拣出库单行（wms_unsorted_order）累计 sum(qty)
    // 注：不要查 wms_inventory.unsorted_qty，那个字段只在 WMS 标准模板导入时填值
    const unsortedQb = this.unsortedOrderRepo
      .createQueryBuilder('u')
      .select('SUM(u.qty)', 's');
    if (warehouse) unsortedQb.where('u.warehouse = :wh', { wh: warehouse });
    const unsortedQty = Number((await unsortedQb.getRawOne()).s) || 0;

    const warnDays = await this.alert.getNumber('expiry_warn_days', 90);
    const expiryAlert = await this.giftRepo
      .createQueryBuilder('g')
      .where('g.effective_date IS NOT NULL')
      .andWhere(
        "g.effective_date <= (CURRENT_DATE + :d::int * INTERVAL '1 day')",
        { d: warnDays },
      )
      .getCount();

    return {
      totalSku,
      eopStock,
      wmsStock,
      diffSku,
      giftSku,
      productSku,
      unsortedQty,
      expiryAlert,
      // warehouse 角色：差异率属财务口径，置 null 脱敏
      diffRate: role === 'warehouse' ? null : diffRate,
    };
  }

  /** 差异趋势（按日）。 */
  async trend(from?: string, to?: string, warehouse?: WarehouseType) {
    const eopBatchId = await this.inventory.getLatestBatch('eop');
    const wmsBatchId = await this.inventory.getLatestBatch('wms');
    if (!eopBatchId || !wmsBatchId) return [];
    const qb = this.reconcileRepo
      .createQueryBuilder('r')
      .where('r.eop_batch_id = :e', { e: eopBatchId })
      .andWhere('r.wms_batch_id = :w', { w: wmsBatchId });
    if (warehouse) qb.andWhere('r.warehouse = :wh', { wh: warehouse });
    if (from) qb.andWhere('r.reconciled_at >= :from', { from });
    if (to) qb.andWhere('r.reconciled_at <= :to', { to });
    qb.select("DATE(r.reconciled_at) as date")
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN r.status != 'match' THEN 1 ELSE 0 END)",
        'diffSku',
      )
      .groupBy("DATE(r.reconciled_at)")
      .orderBy('date', 'ASC');
    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      date: r.date,
      total: Number(r.total),
      diffSku: Number(r.diffSku),
      diffRate: r.total ? Number(r.diffSku) / Number(r.total) : 0,
    }));
  }

  /** 公式可视化数据（R-P0-11）。 */
  async formula(warehouse?: WarehouseType) {
    const eopBatchId = await this.inventory.getLatestBatch('eop');
    const wmsBatchId = await this.inventory.getLatestBatch('wms');
    if (!eopBatchId || !wmsBatchId) {
      return { eopActual: 0, wmsAvailable: 0, eopStock: 0, wmsTotal: 0 };
    }
    const qb = this.reconcileRepo
      .createQueryBuilder('r')
      .where('r.eop_batch_id = :e', { e: eopBatchId })
      .andWhere('r.wms_batch_id = :w', { w: wmsBatchId });
    if (warehouse) qb.andWhere('r.warehouse = :wh', { wh: warehouse });
    qb.select('SUM(r.eop_actual)', 'ea')
      .addSelect('SUM(r.wms_available)', 'wa')
      .addSelect('SUM(r.eop_stock)', 'es')
      .addSelect('SUM(r.wms_total)', 'wt');
    const raw = await qb.getRawOne();
    return {
      eopActual: Number(raw.ea) || 0,
      wmsAvailable: Number(raw.wa) || 0,
      eopStock: Number(raw.es) || 0,
      wmsTotal: Number(raw.wt) || 0,
    };
  }

  /** 未分拣监控（P1 R-P1-03）。 */
  async unsorted(warehouse?: WarehouseType, overdueOnly = false) {
    const wmsBatchId = await this.inventory.getLatestBatch('wms');
    if (!wmsBatchId) return { items: [], total: 0 };
    const qb = this.wmsRepo
      .createQueryBuilder('w')
      .where('w.batch_id = :b', { b: wmsBatchId })
      .andWhere('w.unsorted_qty > 0');
    if (warehouse) qb.andWhere('w.warehouse = :wh', { wh: warehouse });
    const rows = await qb.getMany();
    const barcodeMap = new Map<string, string>(
      (await this.productRepo.find({ select: ['sku_code', 'barcode'] })).map(
        (p) => [p.sku_code, p.barcode || ''],
      ),
    );

    const overdueDaysCfg = await this.alert.getNumber('unsorted_overdue_days', 3);
    const items = rows.map((r) => {
      const snap = new Date(r.snapshot_at).getTime();
      const overdueDays = Math.floor((Date.now() - snap) / 86400000);
      const level =
        overdueDays >= 7
          ? 'urgent'
          : overdueDays >= overdueDaysCfg
            ? 'warning'
            : 'normal';
      return {
        sku_code: r.sku_code,
        barcode: barcodeMap.get(r.sku_code) || '',
        warehouse: r.warehouse,
        unsorted_qty: r.unsorted_qty,
        available_qty: r.available_qty,
        stock_qty: r.stock_qty,
        snapshot_at: r.snapshot_at,
        overdueDays,
        level,
      };
    });
    const filtered = overdueOnly
      ? items.filter((i) => i.overdueDays >= overdueDaysCfg)
      : items;
    filtered.sort((a, b) => b.overdueDays - a.overdueDays);
    return { items: filtered, total: filtered.length };
  }

  /**
   * 未分拣出库单行透视汇总：同一 SKU 可能出现在不同订单，按 SKU 分组
   * 统计 出库单数 / 总数量（数据源 wms_unsorted_order）。
   */
  /**
   * 未分拣明细按「仓库各自最新批次」UNION 查询的 WHERE 片段与参数。
   * 修复：原逻辑只取整表最新单批次，导致导入一仓后另一仓数据从报表"消失"（跨仓互清假象）。
   */
  private buildUnsortedBatchUnion(batchMap: Map<WarehouseType, number>) {
    const conds: string[] = [];
    const params: Record<string, unknown> = {};
    let i = 0;
    for (const [wh, b] of batchMap.entries()) {
      conds.push(`(o.warehouse = :wh${i} AND o.batch_id = :b${i})`);
      params[`wh${i}`] = wh;
      params[`b${i}`] = b;
      i++;
    }
    return { where: conds.join(' OR '), params };
  }

  async unsortedPivot(warehouse?: WarehouseType, page = 1, size = 20) {
    // 每个仓库取各自最新批次（避免"导入正常仓→临期仓数据从报表消失"的跨仓互清假象）；
    // 未分拣明细只进 wms_unsorted_order 不写 wms_inventory，不能用 getLatestBatch('wms') 过滤。
    const whs: WarehouseType[] = warehouse ? [warehouse] : ['normal', 'expired'];
    const batchMap = new Map<WarehouseType, number>();
    for (const wh of whs) {
      const row = await this.unsortedOrderRepo
        .createQueryBuilder('o')
        .select('MAX(o.batch_id)', 'b')
        .where('o.warehouse = :wh', { wh })
        .getRawOne<{ b: number | null }>();
      if (row?.b != null) batchMap.set(wh, Number(row.b));
    }
    if (batchMap.size === 0) return { items: [], total: 0, totalQty: 0 };
    page = Math.max(1, page);
    const rawSize = Number(size);
    const noPaging = !rawSize || rawSize < 0;
    size = noPaging ? 0 : Math.min(500, Math.max(1, Math.floor(rawSize)));
    const { where, params } = this.buildUnsortedBatchUnion(batchMap);
    const qb = this.unsortedOrderRepo
      .createQueryBuilder('o')
      .select('o.sku_code', 'sku_code')
      .addSelect('MIN(o.sku_name)', 'sku_name')
      .addSelect('COUNT(DISTINCT o.order_no)', 'order_count')
      .addSelect('SUM(o.qty)', 'total_qty')
      .addSelect('MIN(o.warehouse)', 'warehouse')
      .where(where, params)
      .groupBy('o.sku_code')
      .orderBy('total_qty', 'DESC');
    if (!noPaging) qb.offset((page - 1) * size).limit(size);
    const barcodeMap = new Map<string, string>(
      (await this.productRepo.find({ select: ['sku_code', 'barcode'] })).map(
        (p) => [p.sku_code, p.barcode || ''],
      ),
    );
    const rows = await qb.getRawMany<{
      sku_code: string;
      sku_name: string;
      order_count: string;
      total_qty: string;
      warehouse: string;
    }>();
    const total = await qb.clone().getCount();
    // 全量数量合计（按 qty 列 SUM，非行数），用于前端底部合计行
    const sumQb = this.unsortedOrderRepo
      .createQueryBuilder('o')
      .select('SUM(o.qty)', 's')
      .where(where, params);
    const totalQty = Number((await sumQb.getRawOne()).s) || 0;
    return {
      items: rows.map((r) => ({
        sku_code: r.sku_code,
        sku_name: r.sku_name || '',
        barcode: barcodeMap.get(r.sku_code) || '',
        order_count: Number(r.order_count) || 0,
        total_qty: Number(r.total_qty) || 0,
        warehouse: r.warehouse,
      })),
      total,
      totalQty,
    };
  }

  /** 未分拣明细导出数据源（含商品条码），导出全部（不过滤超期）。 */
  async exportUnsorted(warehouse?: WarehouseType) {
    const { items } = await this.unsorted(warehouse, false);
    return items;
  }

  /** 退货在途跟踪（P1 R-P1-04）：按仓库维度汇总（每个仓库一行，含 SKU 数/总退货在途/总缺口）。
   * 聚合所有 EOP 批次的 return_qty（不限最新批），避免多仓分别导入时只显示最新仓。
   * 默认返回正常仓+临期仓两行；传入 warehouse 时只返回对应仓库。
   * warehouse 角色对财务口径 eopReturn/gap 脱敏（R-P1-08）。 */
  async returnsTransit(warehouse?: WarehouseType, role?: string) {
    const qb = this.eopRepo.createQueryBuilder('e')
      .select('e.warehouse', 'warehouse')
      .addSelect('e.sku_code', 'sku_code')
      .addSelect('SUM(e.return_qty)', 'total_return')
      .groupBy('e.warehouse')
      .addGroupBy('e.sku_code');
    if (warehouse) {
      qb.where('e.warehouse = :wh', { wh: warehouse });
    }
    const rows = await qb.getRawMany<{
      warehouse: string;
      sku_code: string;
      total_return: string;
    }>();

    // 按仓库维度聚合（保留正常/临期两仓，ret=0 也显示，避免仅一个仓不可见）
    const whMap = new Map<string, { warehouse: string; skuSet: Set<string>; totalReturn: number }>([
      ['normal', { warehouse: 'normal', skuSet: new Set(), totalReturn: 0 }],
      ['expired', { warehouse: 'expired', skuSet: new Set(), totalReturn: 0 }],
    ]);
    for (const r of rows) {
      const wh = r.warehouse || 'normal';
      if (!whMap.has(wh)) {
        whMap.set(wh, { warehouse: wh, skuSet: new Set(), totalReturn: 0 });
      }
      const cur = whMap.get(wh)!;
      const ret = Number(r.total_return) || 0;
      if (ret > 0) cur.skuSet.add(r.sku_code);
      cur.totalReturn += ret;
    }

    // gap = eop_return - wms_equivalent（wms 等效库存暂为 0，gap = eop_return）
    const isWarehouse = role === 'warehouse';
    const items = [...whMap.values()].map((w) => ({
      warehouse: w.warehouse,
      skuCount: w.skuSet.size,
      eopReturn: isWarehouse ? null : w.totalReturn,
      wmsEquivalent: 0,
      gap: isWarehouse ? null : w.totalReturn,
    }));
    return { items, total: items.length };
  }

  /** 效期分布 + 临期/紧急列表（P2 R-P2-01，基于赠品效期，见 Q11 假设）。 */
  /**
   * 效期告警明细（基于最新 WMS 库存快照的 expiration_date，join 商品主档取名称/条码）。
   * 效期是导入时产生的快照属性，非主档字段。返回列：仓库/效期/数量/行号/商品编码/商品条码/中文名称。
   */
  async expiry(warehouse?: WarehouseType) {
    const warn = await this.alert.getNumber('expiry_warn_days', 90);
    const urgent = await this.alert.getNumber('expiry_urgent_days', 30);
    const wmsBatchId = await this.inventory.getLatestBatch('wms');
    const today = Date.now();

    const qb = this.wmsRepo
      .createQueryBuilder('w')
      .leftJoin(Product, 'p', 'p.sku_code = w.sku_code')
      .where('w.batch_id = :b', { b: wmsBatchId })
      .andWhere('w.expiration_date IS NOT NULL');
    if (warehouse) qb.andWhere('w.warehouse = :wh', { wh: warehouse });
    qb.select([
      'w.sku_code AS sku_code',
      'w.warehouse AS warehouse',
      'w.expiration_date AS expiration_date',
      'w.available_qty AS available_qty',
      'w.row_no AS row_no',
      'p.sku_name AS sku_name',
      'p.barcode AS barcode',
    ])
      .orderBy('w.expiration_date', 'ASC');
    const rows = await qb.getRawMany<{
      sku_code: string;
      warehouse: string;
      expiration_date: string;
      available_qty: string;
      row_no: number | null;
      sku_name: string | null;
      barcode: string | null;
    }>();

    const items = rows.map((r) => {
      const days = Math.floor(
        (new Date(r.expiration_date).getTime() - today) / 86400000,
      );
      const level =
        days < 0
          ? 'expired'
          : days < urgent
            ? 'urgent'
            : days < warn
              ? 'warn'
              : 'normal';
      return {
        sku_code: r.sku_code,
        warehouse: r.warehouse,
        expiration_date: r.expiration_date,
        available_qty: Number(r.available_qty) || 0,
        row_no: r.row_no ?? null,
        barcode: r.barcode || '',
        sku_name: r.sku_name || '',
        daysToExpire: days,
        level,
      };
    });

    const buckets = [
      { daysToExpire: -1, label: '<0 已过期', count: 0 },
      { daysToExpire: 30, label: '0-30', count: 0 },
      { daysToExpire: 90, label: '30-90', count: 0 },
      { daysToExpire: 180, label: '90-180', count: 0 },
      { daysToExpire: 9999, label: '>180', count: 0 },
    ];
    items.forEach((i) => {
      if (i.daysToExpire < 0) buckets[0].count++;
      else if (i.daysToExpire < 30) buckets[1].count++;
      else if (i.daysToExpire < 90) buckets[2].count++;
      else if (i.daysToExpire < 180) buckets[3].count++;
      else buckets[4].count++;
    });

    const alerts = items
      .filter((i) => i.level !== 'normal')
      .sort((a, b) => a.daysToExpire - b.daysToExpire);
    return { buckets, items: alerts };
  }

  /** 清空所有业务数据（保留 users / role_permissions / notifications / alert_configs 等系统表）。 */
  async clearAllData(): Promise<{ ok: true; clearedTables: string[]; clearedAt: string }> {
    const tables = [
      'inventory_reconcile',
      'diff_handling',
      'operation_logs',
      'products',
      'eop_inventory',
      'wms_inventory',
      'wms_unsorted_order',
      'upload_batches',
      'gift_skus',
    ];
    await this.dataSource.transaction(async (manager) => {
      // CASCADE 处理外键关联；RESTART IDENTITY 重置自增 ID
      await manager.query(
        `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
      );
    });
    return {
      ok: true,
      clearedTables: tables,
      clearedAt: new Date().toISOString(),
    };
  }

  /** 单表行数（admin 端 UI 展示用）。 */
  async getTableCounts(): Promise<Record<string, number>> {
    return {
      eop_inventory: await this.eopRepo.count(),
      wms_inventory: await this.wmsRepo.count(),
      wms_unsorted_order: await this.unsortedOrderRepo.count(),
      inventory_reconcile: await this.reconcileRepo.count(),
      products: await this.productRepo.count(),
      gift_skus: await this.giftRepo.count(),
      upload_batches: await this.dataSource.manager
        .getRepository('upload_batches')
        .count(),
    };
  }

  /** 单表清空（仅 admin，破坏性操作，前端须二次确认）。
   *  table: eop_inventory / wms_inventory / wms_unsorted_order / inventory_reconcile
   *         / products / gift_skus / upload_batches
   *  对账表清空不影响库存快照；库存/未分拣/批次清空级联删除对账引用行（CASCADE）。
   *
   *  2026-08-23 修正：清空业务库存表时同步删除对应 source 的 upload_batches 记录，
   *  避免用户清空后重新导入同一份文件时因 content_hash 仍在而被误跳过。
   */
  async clearTable(
    table: string,
  ): Promise<{ ok: true; deleted: number; table: string; batchesDeleted: number; clearedAt: string }> {
    const allow = new Set([
      'eop_inventory',
      'wms_inventory',
      'wms_unsorted_order',
      'inventory_reconcile',
      'products',
      'gift_skus',
      'upload_batches',
    ]);
    if (!allow.has(table)) {
      throw new BadRequestException(
        `不支持的表: ${table}，可选: ${[...allow].join(', ')}`,
      );
    }
    const sourceMap: Record<string, SourceType> = {
      eop_inventory: 'eop',
      wms_inventory: 'wms',
      wms_unsorted_order: 'unsorted',
      gift_skus: 'gift',
    };
    const source = sourceMap[table];

    const { deleted, batchesDeleted } = await this.dataSource.transaction(async (manager) => {
      const r = await manager
        .createQueryBuilder()
        .delete()
        .from(table)
        .execute();
      let bd = 0;
      if (source) {
        const br = await manager
          .createQueryBuilder()
          .delete()
          .from('upload_batches')
          .where('source = :s', { s: source })
          .execute();
        bd = br.affected || 0;
      }
      return { deleted: r.affected || 0, batchesDeleted: bd };
    });
    return {
      ok: true,
      deleted,
      batchesDeleted,
      table,
      clearedAt: new Date().toISOString(),
    };
  }
}
