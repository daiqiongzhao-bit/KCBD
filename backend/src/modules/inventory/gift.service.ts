import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GiftSku } from './entities/gift-sku.entity';
import { Product } from './entities/product.entity';

export interface GiftQuery {
  keyword?: string;
  page?: number;
  size?: number;
}

@Injectable()
export class GiftService {
  constructor(
    @InjectRepository(GiftSku)
    private readonly giftRepo: Repository<GiftSku>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async list(query: GiftQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.min(500, Math.max(1, Number(query.size) || 20));
    const qb = this.giftRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.product', 'p');
    if (query.keyword) {
      qb.where('g.sku_code LIKE :kw', { kw: `%${query.keyword}%` });
    }
    qb.orderBy('g.id', 'DESC').skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async create(data: {
    sku_code: string;
    effective_date?: string;
    sku_name?: string;
    product_id?: number | null;
  }) {
    const exists = await this.giftRepo.findOne({
      where: { sku_code: data.sku_code },
    });
    if (!exists) {
      await this.giftRepo.save(
        this.giftRepo.create({
          sku_code: data.sku_code,
          effective_date: data.effective_date || null,
          product_id: data.product_id ?? null,
        }),
      );
    }
    await this.markProductGift(data.sku_code, true, data.sku_name);
    return { id: exists ? exists.id : (await this.giftRepo.findOne({ where: { sku_code: data.sku_code } }))!.id };
  }

  async update(
    id: number,
    data: { effective_date?: string; sku_name?: string; product_id?: number | null },
  ) {
    const gift = await this.giftRepo.findOne({ where: { id } });
    if (data.effective_date !== undefined) gift!.effective_date = data.effective_date;
    if (data.product_id !== undefined) gift!.product_id = data.product_id;
    await this.giftRepo.save(gift!);
    if (data.sku_name !== undefined) {
      await this.markProductGift(gift!.sku_code, true, data.sku_name);
    }
    return { id };
  }

  async remove(id: number) {
    const gift = await this.giftRepo.findOne({ where: { id } });
    if (gift) {
      await this.giftRepo.remove(gift);
      await this.markProductGift(gift.sku_code, false);
    }
    return { id };
  }

  private async markProductGift(
    skuCode: string,
    isGift: boolean,
    skuName?: string,
  ) {
    let p = await this.productRepo.findOne({ where: { sku_code: skuCode } });
    if (!p) {
      p = this.productRepo.create({ sku_code: skuCode });
    }
    if (skuName) p.sku_name = skuName;
    p.is_gift = isGift;
    await this.productRepo.save(p);
  }
}
