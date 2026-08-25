import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { GiftSku } from './entities/gift-sku.entity';
import { parseExcelBuffer } from '../upload/parsers/excel.parser';

export interface ProductQuery {
  isGift?: boolean;
  keyword?: string;
  page?: number;
  size?: number;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(GiftSku)
    private readonly giftRepo: Repository<GiftSku>,
  ) {}

  /** 新增商品主档（sku_code 唯一）。 */
  async create(data: {
    sku_code: string;
    sku_name?: string;
    barcode?: string;
    is_gift?: boolean;
  }) {
    const sku = (data.sku_code || '').trim();
    if (!sku) throw new BadRequestException('商品编码不能为空');
    const exists = await this.productRepo.findOne({ where: { sku_code: sku } });
    if (exists) throw new BadRequestException('该商品编码已存在');
    const p = this.productRepo.create({
      sku_code: sku,
      sku_name: data.sku_name?.trim() || '',
      barcode: data.barcode?.trim() || null,
      is_gift: data.is_gift ?? false,
    });
    const saved = await this.productRepo.save(p);
    return { id: saved.id };
  }

  /** 修改商品主档（名称/条码/是否赠品）。 */
  async update(
    id: number,
    body: { sku_name?: string; barcode?: string; is_gift?: boolean },
  ) {
    const p = await this.productRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('商品不存在');
    if (body.sku_name !== undefined) p.sku_name = body.sku_name.trim();
    if (body.barcode !== undefined) p.barcode = body.barcode.trim() || null;
    if (body.is_gift !== undefined) p.is_gift = body.is_gift;
    await this.productRepo.save(p);
    return { id };
  }

  /** 删除商品主档（被赠品关联时拒绝）。 */
  async remove(id: number) {
    const p = await this.productRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('商品不存在');
    const refCount = await this.giftRepo.count({ where: { product_id: id } });
    if (refCount > 0) {
      throw new BadRequestException('该商品已被赠品关联，不能删除');
    }
    await this.productRepo.remove(p);
    return { id };
  }

  /** 从 Excel/CSV 导入商品主档：识别 商品编码/中文名称/商品条码 列并批量 upsert。 */
  async importFromExcel(buffer: Buffer): Promise<{ total: number; imported: number; skipped: number }> {
    const { headers, rows } = parseExcelBuffer(buffer);
    const lower = headers.map((h) => h.toLowerCase());
    const pick = (keywords: string[]): string | undefined => {
      for (const kw of keywords) {
        const idx = lower.findIndex((h) => h.includes(kw.toLowerCase()));
        if (idx >= 0) return headers[idx];
      }
      return undefined;
    };
    const skuHeader = pick(['商品编码', 'sku', '编码', 'item']);
    const nameHeader = pick(['中文名称', '名称', '品名', 'sku_name', 'name']);
    const barcodeHeader = pick(['商品条码', '条码', 'barcode']);
    if (!skuHeader) throw new BadRequestException('未找到「商品编码」列');

    let imported = 0;
    let skipped = 0;
    for (const r of rows) {
      const sku = String(r[skuHeader] ?? '').trim();
      if (!sku) {
        skipped++;
        continue;
      }
      const name = nameHeader ? String(r[nameHeader] ?? '').trim() : '';
      const barcode = barcodeHeader ? String(r[barcodeHeader] ?? '').trim() : '';
      await this.upsert(sku, name, false, barcode || undefined);
      imported++;
    }
    return { total: rows.length, imported, skipped };
  }

  /** 按 sku_code upsert 商品主数据（gift 源导入时置 is_gift=true）。 */
  async upsert(
    skuCode: string,
    skuName: string,
    isGift = false,
    barcode?: string,
  ): Promise<Product> {
    let product = await this.productRepo.findOne({ where: { sku_code: skuCode } });
    if (!product) {
      product = this.productRepo.create({ sku_code: skuCode });
    }
    if (skuName) product.sku_name = skuName;
    if (barcode) product.barcode = barcode;
    if (isGift) product.is_gift = true;
    return this.productRepo.save(product);
  }

  /** 批量 upsert。 */
  async bulkUpsert(
    rows: { sku_code: string; sku_name: string; is_gift?: boolean }[],
  ): Promise<void> {
    for (const r of rows) {
      await this.upsert(r.sku_code, r.sku_name, r.is_gift);
    }
  }

  async list(query: ProductQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.min(500, Math.max(1, Number(query.size) || 20));
    const qb = this.productRepo.createQueryBuilder('p');
    if (query.isGift !== undefined) {
      qb.where('p.is_gift = :g', { g: query.isGift });
    }
    if (query.keyword) {
      qb.andWhere('p.sku_code LIKE :kw OR p.sku_name LIKE :kw', {
        kw: `%${query.keyword}%`,
      });
    }
    qb.orderBy('p.id', 'ASC').skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /** 返回 sku_code -> is_gift 映射，用于赠品拆分识别。 */
  async giftMap(): Promise<Map<string, boolean>> {
    const all = await this.productRepo.find();
    const map = new Map<string, boolean>();
    all.forEach((p) => map.set(p.sku_code, p.is_gift));
    return map;
  }

  async findBySkus(skus: string[]): Promise<Product[]> {
    if (skus.length === 0) return [];
    return this.productRepo.find({ where: { sku_code: In(skus) } });
  }
}
