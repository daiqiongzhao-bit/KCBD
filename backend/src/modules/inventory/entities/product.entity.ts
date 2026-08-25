import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 商品主数据。 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sku_code', unique: true, length: 64 })
  sku_code: string;

  @Column({ name: 'sku_name', length: 255, default: '' })
  sku_name: string;

  /** 商品条码（EOP 导入时写入，非主档手工维护字段）。 */
  @Column({ name: 'barcode', length: 64, nullable: true })
  barcode: string | null;

  @Column({ name: 'is_gift', default: false })
  is_gift: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
