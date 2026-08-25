import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { EopInventory } from './entities/eop-inventory.entity';
import { WmsInventory } from './entities/wms-inventory.entity';
import { UploadBatch } from './entities/upload-batch.entity';
import { GiftSku } from './entities/gift-sku.entity';
import { Product } from './entities/product.entity';
import { InventoryReconcile } from '../reconcile/entities/inventory-reconcile.entity';
import { WmsUnsortedOrder } from './entities/wms-unsorted-order.entity';
import { WarehouseType, SourceType } from '../../common/constants/types';
import { normalizePage } from '../../common/utils/pagination';

export interface EopRowInput {
  sku_code: string;
  warehouse: WarehouseType;
  stock_qty: number;
  actual_qty: number;
  return_qty: number;
}

export interface WmsRowInput {
  sku_code: string;
  warehouse: WarehouseType;
  stock_qty: number;
  available_qty: number;
  unsorted_qty: number;
  batch_id?: number;
  expiration_date?: string | null;
  row_no?: number | null;
  /** WMS 模板其余列透传（companyCode/locationCode/...等），由 upload.service 平铺。 */
  extras?: Record<string, any>;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(EopInventory)
    private readonly eopRepo: Repository<EopInventory>,
    @InjectRepository(WmsInventory)
    private readonly wmsRepo: Repository<WmsInventory>,
    @InjectRepository(UploadBatch)
    private readonly batchRepo: Repository<UploadBatch>,
    @InjectRepository(GiftSku)
    private readonly giftRepo: Repository<GiftSku>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(InventoryReconcile)
    private readonly reconcileRepo: Repository<InventoryReconcile>,
    @InjectRepository(WmsUnsortedOrder)
    private readonly unsortedOrderRepo: Repository<WmsUnsortedOrder>,
  ) {}

  async saveEopRows(batchId: number, rows: EopRowInput[]): Promise<void> {
    if (rows.length === 0) return;
    const entities = rows.map((r) =>
      this.eopRepo.create({
        batch_id: batchId,
        sku_code: r.sku_code,
        warehouse: r.warehouse,
        stock_qty: r.stock_qty,
        actual_qty: r.actual_qty,
        return_qty: r.return_qty,
      }),
    );
    await this.eopRepo.save(entities, { chunk: 1000 });
  }

  async saveWmsRows(batchId: number, rows: WmsRowInput[]): Promise<void> {
    if (rows.length === 0) return;
    const entities = rows.map((r) =>
      this.wmsRepo.create({
        batch_id: batchId,
        sku_code: r.sku_code,
        warehouse: r.warehouse,
        stock_qty: r.stock_qty,
        available_qty: r.available_qty,
        unsorted_qty: r.unsorted_qty,
      }),
    );
    await this.wmsRepo.save(entities, { chunk: 1000 });
  }

  /**
   * 最新的成功导入批次 id。
   * isGift 可选：指定时仅匹配该类型的批次（true=赠品文件，false=正常商品文件）。
   */
  async getLatestBatch(
    source: SourceType,
    isGift?: boolean,
  ): Promise<number | null> {
    const where: Record<string, unknown> = { source, status: 'success' };
    if (isGift !== undefined) where.is_gift = isGift;
    const batch = await this.batchRepo.findOne({
      where,
      order: { imported_at: 'DESC' },
    });
    return batch ? batch.id : null;
  }

  /**
   * 指定仓库的最新成功导入批次 id。
   * 对账按仓库维度进行时，必须用「该仓库存在数据的最新批次」，
   * 否则若最近一次导入恰好是另一仓库（如最新 EOP 批次是临期仓专属），
   * 当前仓库的对账会因取不到数据而得到 0 行（P0 回归）。
   * isGift 可选：指定时仅匹配该类型的批次（true=赠品文件，false=正常商品文件）。
   */
  async getLatestBatchForWarehouse(
    source: SourceType,
    warehouse: WarehouseType,
    isGift?: boolean,
  ): Promise<number | null> {
    const table = source === 'eop' ? 'eop_inventory' : 'wms_inventory';
    const rows = await this.batchRepo.query(
      `SELECT b.id FROM upload_batches b
       WHERE b.source = $1 AND b.status = 'success'
         ${isGift !== undefined ? "AND b.is_gift = $3" : ''}
         AND EXISTS (SELECT 1 FROM ${table} i WHERE i.batch_id = b.id AND i.warehouse = $2)
       ORDER BY b.imported_at DESC
       LIMIT 1`,
      isGift !== undefined
        ? [source, warehouse, isGift]
        : [source, warehouse],
    );
    return rows[0]?.id ?? null;
  }

  async getBatch(id: number): Promise<UploadBatch | null> {
    return this.batchRepo.findOne({ where: { id } });
  }

  async getEopByBatch(
    batchId: number,
    warehouse?: WarehouseType,
  ): Promise<EopInventory[]> {
    const where: Record<string, unknown> = { batch_id: batchId };
    if (warehouse) where.warehouse = warehouse;
    return this.eopRepo.find({ where });
  }

  /**
   * 未分拣出库单行明细（按最新一批 WMS，区分正常/临期仓，支持分页）。
   * 用于库存模块「未分拣报表」Tab 展示。
   */
  /**
   * 未分拣明细按「仓库各自最新批次」取源。
   * 每个仓库的未分拣报表是整文件快照，导入即覆盖该仓旧批次；
   * 用全局最新单批次会导致「导入正常仓 → 临期仓数据从报表消失」的跨仓互清假象。
   * 返回 warehouse -> 该仓最大 batch_id（仅含确有数据的仓库）。
   */
  private async latestUnsortedBatchByWh(
    only?: WarehouseType,
  ): Promise<Map<WarehouseType, number>> {
    const whs: WarehouseType[] = only ? [only] : ['normal', 'expired'];
    const map = new Map<WarehouseType, number>();
    for (const wh of whs) {
      const row = await this.unsortedOrderRepo
        .createQueryBuilder('o')
        .select('MAX(o.batch_id)', 'b')
        .where('o.warehouse = :wh', { wh })
        .getRawOne<{ b: number | null }>();
      if (row?.b != null) map.set(wh, Number(row.b));
    }
    return map;
  }

  /**
   * 把「仓库+最新批次」映射拼成 (warehouse=wh AND batch_id=b) OR ... 的 WHERE 片段与参数。
   * 用于未分拣明细的多仓合并查询，避免单批次过滤造成的跨仓互清。
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

  async listUnsortedOrders(query: {
    warehouse?: WarehouseType;
    batchId?: number;
    sku?: string;
    barcode?: string;
    skuName?: string;
    isGift?: boolean;
    page?: number;
    size?: number;
  }): Promise<{ items: WmsUnsortedOrder[]; total: number; batchId: number | null }> {
    const { page, size } = normalizePage(query.page, query.size);
    let qb = this.unsortedOrderRepo.createQueryBuilder('o');
    let resolvedBatchId: number | null = null;
    if (query.batchId) {
      // 显式指定批次时按该批次查（保持原语义）
      qb = qb.where('o.batch_id = :b', { b: query.batchId });
      resolvedBatchId = query.batchId;
    } else {
      // 否则取各仓库各自最新批次 UNION（修复「导入一仓→另一仓数据消失」的跨仓互清）
      const batchMap = await this.latestUnsortedBatchByWh(query.warehouse);
      if (batchMap.size === 0) {
        // 无任何未分拣明细时回退到最新 WMS 批次（保持原语义，避免空结果）
        const fb = await this.getLatestBatch('wms');
        if (!fb) return { items: [], total: 0, batchId: null };
        qb = qb.where('o.batch_id = :b', { b: fb });
        resolvedBatchId = fb;
      } else {
        const { where, params } = this.buildUnsortedBatchUnion(batchMap);
        qb = qb.where(where, params);
        resolvedBatchId = Math.max(...batchMap.values());
      }
    }
    if (query.warehouse) {
      qb = qb.andWhere('o.warehouse = :wh', { wh: query.warehouse });
    }
    if (query.sku) {
      qb = qb.andWhere('o.sku_code ILIKE :sk', { sk: `%${query.sku}%` });
    }
    if (query.barcode) {
      qb = qb.andWhere('o.sku_code IN (SELECT sku_code FROM products WHERE barcode ILIKE :bc)', { bc: `%${query.barcode}%` });
    }
    if (query.skuName) {
      qb = qb.andWhere('(o.sku_name ILIKE :sn OR p.sku_name ILIKE :sn)', { sn: `%${query.skuName}%` });
    }
    if (query.isGift !== undefined) {
      qb = qb.andWhere('o.sku_code IN (SELECT sku_code FROM products WHERE is_gift = :g)', { g: query.isGift });
    }
    qb.leftJoin(Product, 'p', 'p.sku_code = o.sku_code')
      .addSelect('p.sku_name', 'sku_name')
      .addSelect('p.barcode', 'barcode')
      .orderBy('o.id', 'ASC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, batchId: resolvedBatchId };
  }

  /**
   * 未分拣明细（wms_unsorted_order）按 sku + 仓库 聚合数量。
   * 对账引擎需要它把"未分拣量"纳入 wms_unsorted（未分拣模板只入明细表、
   * 不写 wms_inventory，否则对账页 WMS 未分拣恒为 0）。
   * 返回 key = `${sku}|${warehouse}` → 数量合计。
   */
  async aggregateUnsortedQtyBySkuWarehouse(): Promise<Map<string, number>> {
    // 仅聚合各仓库最新批次（整文件快照，重复导入同一仓不应重复累加）
    const batchMap = await this.latestUnsortedBatchByWh();
    if (batchMap.size === 0) return new Map();
    const { where, params } = this.buildUnsortedBatchUnion(batchMap);
    const rows = await this.unsortedOrderRepo
      .createQueryBuilder('o')
      .select('o.sku_code', 'sku')
      .addSelect('o.warehouse', 'wh')
      .addSelect('SUM(o.qty)', 'qty')
      .where(where, params)
      .groupBy('o.sku_code')
      .addGroupBy('o.warehouse')
      .getRawMany<{ sku: string; wh: string; qty: string }>();
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(`${r.sku}|${r.wh}`, Number(r.qty) || 0);
    }
    return m;
  }

  async getWmsByBatch(
    batchId: number,
    warehouse?: WarehouseType,
  ): Promise<WmsInventory[]> {
    const where: Record<string, unknown> = { batch_id: batchId };
    if (warehouse) where.warehouse = warehouse;
    return this.wmsRepo.find({ where });
  }

  async upsertGiftSkus(
    rows: { sku_code: string; effective_date?: string }[],
  ): Promise<void> {
    for (const r of rows) {
      const existing = await this.giftRepo.findOne({
        where: { sku_code: r.sku_code },
      });
      if (!existing) {
        await this.giftRepo.save(
          this.giftRepo.create({
            sku_code: r.sku_code,
            effective_date: r.effective_date || null,
          }),
        );
      }
    }
  }

  async listBatches(query: {
    source?: SourceType;
    page?: number;
    size?: number;
  }) {
    const { page, size } = normalizePage(query.page, query.size, 200);
    const qb = this.batchRepo.createQueryBuilder('b');
    if (query.source) {
      qb.where('b.source = :s', { s: query.source });
    }
    qb.orderBy('b.imported_at', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** 含未分拣出库单行的 WMS 批次（供未分拣报表批次下拉回溯）。 */
  async listUnsortedBatches() {
    const rows = await this.unsortedOrderRepo
      .createQueryBuilder('o')
      .select('o.batch_id', 'batch_id')
      .addSelect('MAX(b.imported_at)', 'imported_at')
      .addSelect('COUNT(*)', 'order_count')
      .leftJoin(UploadBatch, 'b', 'b.id = o.batch_id')
      .groupBy('o.batch_id')
      .orderBy('MAX(b.imported_at)', 'DESC')
      .getRawMany<{ batch_id: string; imported_at: Date | null; order_count: string }>();
    return rows.map((r) => ({
      id: Number(r.batch_id),
      imported_at: r.imported_at ?? null,
      order_count: Number(r.order_count) || 0,
    }));
  }

  async listEop(query: {
    batchId?: number;
    warehouse?: WarehouseType;
    sku?: string;
    barcode?: string;
    skuName?: string;
    categoryNew?: string;
    brand?: string;
    store?: string;
    subStore?: string;
    counter?: string;
    isGift?: boolean;
    page?: number;
    size?: number;
  }) {
    const { page, size } = normalizePage(query.page, query.size);
    const qb = this.eopRepo.createQueryBuilder('e');
    if (query.batchId) qb.where('e.batch_id = :b', { b: query.batchId });
    if (query.warehouse) qb.andWhere('e.warehouse = :w', { w: query.warehouse });
    if (query.sku) qb.andWhere('e.sku_code ILIKE :sk', { sk: `%${query.sku}%` });
    if (query.barcode) qb.andWhere('e.barcode ILIKE :bc', { bc: `%${query.barcode}%` });
    if (query.skuName) qb.andWhere('(e.sku_name ILIKE :sn OR p.sku_name ILIKE :sn)', { sn: `%${query.skuName}%` });
    if (query.categoryNew) qb.andWhere('e.category_new ILIKE :cn', { cn: `%${query.categoryNew}%` });
    if (query.brand) qb.andWhere('e.brand ILIKE :br', { br: `%${query.brand}%` });
    if (query.store) qb.andWhere('e.store ILIKE :st', { st: `%${query.store}%` });
    if (query.subStore) qb.andWhere('e.sub_store ILIKE :sst', { sst: `%${query.subStore}%` });
    if (query.counter) qb.andWhere('e.counter ILIKE :ct', { ct: `%${query.counter}%` });
    if (query.isGift !== undefined) {
      qb.andWhere('e.sku_code IN (SELECT sku_code FROM products WHERE is_gift = :g)', { g: query.isGift });
    }
    qb.leftJoin(Product, 'p', 'p.sku_code = e.sku_code')
      .addSelect('p.sku_name', 'sku_name')
      .addSelect('p.barcode', 'barcode')
      .orderBy('e.id', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const { entities, raw } = await qb.getRawAndEntities();
    const items = entities.map((e, i) => ({
      ...e,
      sku_name: raw[i]?.sku_name || e.sku_name || '',
      barcode: raw[i]?.barcode || null,
    }));
    const total = await qb.clone().getCount();
    return { items, total };
  }

  async listWms(query: {
    batchId?: number;
    warehouse?: WarehouseType;
    sku?: string;
    barcode?: string;
    skuName?: string;
    locationCode?: string;
    isGift?: boolean;
    page?: number;
    size?: number;
  }) {
    const { page, size } = normalizePage(query.page, query.size);
    const qb = this.wmsRepo.createQueryBuilder('w');
    if (query.batchId) qb.where('w.batch_id = :b', { b: query.batchId });
    if (query.warehouse) qb.andWhere('w.warehouse = :wh', { wh: query.warehouse });
    if (query.sku) qb.andWhere('w.sku_code ILIKE :sk', { sk: `%${query.sku}%` });
    if (query.barcode) qb.andWhere('w.sku_code IN (SELECT sku_code FROM products WHERE barcode ILIKE :bc)', { bc: `%${query.barcode}%` });
    if (query.skuName) qb.andWhere('(w.sku_name ILIKE :sn OR p.sku_name ILIKE :sn)', { sn: `%${query.skuName}%` });
    if (query.locationCode) qb.andWhere('w.location_code ILIKE :lc', { lc: `%${query.locationCode}%` });
    if (query.isGift !== undefined) {
      qb.andWhere('w.sku_code IN (SELECT sku_code FROM products WHERE is_gift = :g)', { g: query.isGift });
    }
    qb.leftJoin(Product, 'p', 'p.sku_code = w.sku_code')
      .addSelect('p.sku_name', 'sku_name')
      .addSelect('p.barcode', 'barcode')
      .orderBy('w.id', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const { entities, raw } = await qb.getRawAndEntities();
    const items = entities.map((e, i) => ({
      ...e,
      sku_name: raw[i]?.sku_name || e.sku_name || '',
      barcode: raw[i]?.barcode || null,
    }));
    const total = await qb.clone().getCount();
    return { items, total };
  }

  async saveBatch(batch: UploadBatch): Promise<UploadBatch> {
    return this.batchRepo.save(batch);
  }

  async findExistingBatch(
    source: SourceType,
    contentHash: string,
  ): Promise<UploadBatch | null> {
    return this.batchRepo.findOne({
      where: { source, content_hash: contentHash, status: 'success' },
    });
  }

  /**
   * 编辑/删除 EOP/WMS 库存行：行已被对账引用则禁止删除，编辑仅允许改核心数值/仓库。
   * 对账表 inventory_reconcile 通过 sku_code + warehouse + batch 关联。
   * batchId 传入行自身批次，避免"最新批次是赠品文件"时正常商品行的引用检查失真。
   */
  private async isReferencedByReconcile(
    source: 'eop' | 'wms',
    sku_code: string,
    warehouse: WarehouseType,
    batchId?: number,
  ): Promise<boolean> {
    const where: Record<string, unknown> = { sku_code, warehouse, cleared: false };
    if (source === 'eop') {
      where.eop_batch_id = batchId ?? (await this.getLatestBatch('eop'));
    } else {
      where.wms_batch_id = batchId ?? (await this.getLatestBatch('wms'));
    }
    const count = await this.reconcileRepo.count({ where });
    return count > 0;
  }

  async updateEop(
    id: number,
    body: { stock_qty?: number; actual_qty?: number; return_qty?: number; warehouse?: WarehouseType },
  ) {
    const e = await this.eopRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('EOP 库存行不存在');
    if (body.warehouse && body.warehouse !== e.warehouse) {
      const ref = await this.isReferencedByReconcile(
        'eop',
        e.sku_code,
        e.warehouse,
        e.batch_id,
      );
      if (ref) throw new BadRequestException('该行已被对账引用，不能切换仓库类型');
    }
    if (body.stock_qty !== undefined) e.stock_qty = body.stock_qty;
    if (body.actual_qty !== undefined) e.actual_qty = body.actual_qty;
    if (body.return_qty !== undefined) e.return_qty = body.return_qty;
    if (body.warehouse) e.warehouse = body.warehouse;
    await this.eopRepo.save(e);
    return { id };
  }

  async removeEop(id: number) {
    const e = await this.eopRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('EOP 库存行不存在');
    const ref = await this.isReferencedByReconcile(
      'eop',
      e.sku_code,
      e.warehouse,
      e.batch_id,
    );
    if (ref) throw new BadRequestException('该行已被对账引用，不能删除');
    await this.eopRepo.remove(e);
    return { id };
  }

  async updateWms(
    id: number,
    body: {
      stock_qty?: number;
      available_qty?: number;
      unsorted_qty?: number;
      warehouse?: WarehouseType;
    },
  ) {
    const w = await this.wmsRepo.findOne({ where: { id } });
    if (!w) throw new NotFoundException('WMS 库存行不存在');
    if (body.warehouse && body.warehouse !== w.warehouse) {
      const ref = await this.isReferencedByReconcile(
        'wms',
        w.sku_code,
        w.warehouse,
        w.batch_id,
      );
      if (ref) throw new BadRequestException('该行已被对账引用，不能切换仓库类型');
    }
    if (body.stock_qty !== undefined) w.stock_qty = body.stock_qty;
    if (body.available_qty !== undefined) w.available_qty = body.available_qty;
    if (body.unsorted_qty !== undefined) w.unsorted_qty = body.unsorted_qty;
    if (body.warehouse) w.warehouse = body.warehouse;
    // 改 stock_qty 时联动 available_qty（保持 BR-03：stock = available + unsorted）
    if (body.stock_qty !== undefined && body.available_qty === undefined) {
      w.available_qty = w.stock_qty - w.unsorted_qty;
    }
    await this.wmsRepo.save(w);
    return { id };
  }

  async removeWms(id: number) {
    const w = await this.wmsRepo.findOne({ where: { id } });
    if (!w) throw new NotFoundException('WMS 库存行不存在');
    const ref = await this.isReferencedByReconcile(
      'wms',
      w.sku_code,
      w.warehouse,
      w.batch_id,
    );
    if (ref) throw new BadRequestException('该行已被对账引用，不能删除');
    await this.wmsRepo.remove(w);
    return { id };
  }

  /** 导出 EOP 库存为 Excel（按当前查询条件，最多 5000 行）。 */
  async exportEop(query: {
    batchId?: number;
    warehouse?: WarehouseType;
    sku?: string;
    barcode?: string;
    skuName?: string;
    categoryNew?: string;
    brand?: string;
    store?: string;
    subStore?: string;
    counter?: string;
    isGift?: boolean;
  }): Promise<Buffer> {
    const { items } = await this.listEop({ ...query, page: 1, size: 0 });
    const rows = (items as EopInventory[]).map((r) => ({
      仓库: r.warehouse === 'normal' ? '正常仓' : '临期仓',
      商品编码: r.sku_code,
      商品条码: r.barcode || '',
      中文名称: r.sku_name || '',
      '中文名称-全称': r.sku_name_full || '',
      英文名称: r.english_name || '',
      商品规格: r.spec || '',
      '规格-全称': r.spec_full || '',
      商品新分类: r.category_new || '',
      品牌: r.brand || '',
      库存数量: r.stock_qty,
      退货数量: r.return_qty,
      实际库存数量: r.actual_qty,
      门店: r.store || '',
      店面: r.sub_store || '',
      柜组: r.counter || '',
      大类: r.big_class || '',
      供应商: r.supplier || '',
      经营方式: r.business_mode || '',
      厂商货号: r.prod_no || '',
      '厂商货号-全称': r.prod_no_full || '',
      类别: r.category || '',
      是否样品: r.is_sample || '',
      平均含税进价: r.avg_price_tax_in,
      平均不含税进价: r.avg_price_tax_out,
      库存含税进价金额: r.stock_amt_tax_in,
      库存不含税进价金额: r.stock_amt_tax_out,
      售价: r.sale_price,
      售价金额: r.sale_amt,
      适用季节: r.season || '',
      花色: r.color || '',
      尺码: r.size || '',
      款式: r.style || '',
      内部季节: r.season_inner || '',
      SKC精品: r.skc_boutique || '',
      SPU精品: r.spu_boutique || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'EOP库存');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** 导出 WMS 库存为 Excel（按当前查询条件，最多 5000 行）。 */
  async exportWms(query: {
    batchId?: number;
    warehouse?: WarehouseType;
    sku?: string;
    barcode?: string;
    skuName?: string;
    locationCode?: string;
    isGift?: boolean;
  }): Promise<Buffer> {
    const { items } = await this.listWms({ ...query, page: 1, size: 0 });
    const rows = (items as WmsInventory[]).map((r) => ({
      仓库: r.warehouse === 'normal' ? '正常仓' : '临期仓',
      companyCode: r.company_code || '',
      商品编码: r.sku_code,
      商品名称: r.sku_name || '',
      库位: r.location_code || '',
      库区: r.zone_code || '',
      'onHandQty 库存数量': r.stock_qty,
      'inTransitQty 在途': r.in_transit_qty,
      'allocatedQty 已分配': r.allocated_qty,
      'lockedQty 锁定': r.locked_qty,
      'frozenQty 冻结': r.frozen_qty,
      'availableQty 可用': r.available_qty,
      未分拣: r.unsorted_qty,
      批次: r.lot || '',
      生产日期: r.manufacture_date || '',
      expirationDate效期: r.expiration_date || '',
      agingDate库龄: r.aging_date || '',
      attribute1: r.attribute1 || '',
      inventorySts: r.inventory_sts || '',
      lpn: r.lpn || '',
      shelfLifeSts: r.shelf_life_sts || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WMS库存');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** 导出未分拣报表为 Excel（按当前查询条件，最多 5000 行）。 */
  async exportUnsortedOrders(query: {
    warehouse?: WarehouseType;
    batchId?: number;
    sku?: string;
    barcode?: string;
    skuName?: string;
    isGift?: boolean;
  }): Promise<Buffer> {
    const { items } = await this.listUnsortedOrders({ ...query, page: 1, size: 0 });
    const rows = (items as WmsUnsortedOrder[]).map((r) => ({
      仓库: r.warehouse === 'normal' ? '正常仓' : '临期仓',
      出库单号: r.order_no || '',
      商品编码: r.sku_code,
      商品名称: r.sku_name || '',
      数量: r.qty,
      波次号: r.wave_no || '',
      快递单号: r.express_no || '',
      承运人: r.carrier_code || '',
      收件人: r.recipient || '',
      地址: r.address || '',
      创建时间: r.created_at || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '未分拣报表');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
