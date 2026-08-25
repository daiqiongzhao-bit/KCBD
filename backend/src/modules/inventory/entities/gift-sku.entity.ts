import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

/** 赠品清单（来自 R-P0-03 导入 + R-P2-02 维护），product_id 关联商品主档。 */
@Entity('gift_skus')
@Index('uq_gift_sku', ['sku_code'], { unique: true })
export class GiftSku {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sku_code', length: 64 })
  sku_code: string;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effective_date: string;

  /** 关联商品主档（可为空：赠品 SKU 尚未匹配主档）。 */
  @Column({ name: 'product_id', type: 'int', nullable: true })
  product_id: number | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
