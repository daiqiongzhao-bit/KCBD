import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WarehouseType } from '../../../common/constants/types';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

/** EOP 库存快照（按 EOP 模板的 36 列完整保留），所有文本/数值列均入库。 */
@Entity('eop_inventory')
@Index('idx_eop_batch_sku', ['batch_id', 'sku_code', 'warehouse'])
export class EopInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_id' })
  batch_id: number;

  /** 模板行号（按数据行顺序 1..N）。 */
  @Column({ name: 'row_no', type: 'int', nullable: true })
  row_no: number | null;

  @Column({ name: 'sku_code', length: 64 })
  sku_code: string;

  @Column({ type: 'varchar', length: 16 })
  warehouse: WarehouseType;

  @Column({ name: 'barcode', length: 64, nullable: true })
  barcode: string | null;

  @Column({ name: 'sku_name', length: 255, nullable: true })
  sku_name: string | null;

  @Column({ name: 'sku_name_full', length: 255, nullable: true })
  sku_name_full: string | null;

  @Column({ name: 'english_name', length: 255, nullable: true })
  english_name: string | null;

  @Column({ name: 'spec', length: 128, nullable: true })
  spec: string | null;

  @Column({ name: 'spec_full', length: 128, nullable: true })
  spec_full: string | null;

  @Column({ name: 'category_new', length: 128, nullable: true })
  category_new: string | null;

  @Column({ name: 'brand', length: 128, nullable: true })
  brand: string | null;

  @Column({
    type: 'numeric', precision: 18, scale: 3,
    name: 'stock_qty', transformer: NumericTransformer,
  })
  stock_qty: number;

  @Column({
    type: 'numeric', precision: 18, scale: 3,
    name: 'return_qty', default: 0, transformer: NumericTransformer,
  })
  return_qty: number;

  @Column({
    type: 'numeric', precision: 18, scale: 3,
    name: 'actual_qty', default: 0, transformer: NumericTransformer,
  })
  actual_qty: number;

  @Column({ name: 'store', length: 128, nullable: true })
  store: string | null;
  @Column({ name: 'sub_store', length: 128, nullable: true })
  sub_store: string | null;
  @Column({ name: 'counter', length: 128, nullable: true })
  counter: string | null;
  @Column({ name: 'big_class', length: 64, nullable: true })
  big_class: string | null;
  @Column({ name: 'supplier', length: 128, nullable: true })
  supplier: string | null;
  @Column({ name: 'business_mode', length: 64, nullable: true })
  business_mode: string | null;
  @Column({ name: 'prod_no', length: 128, nullable: true })
  prod_no: string | null;
  @Column({ name: 'prod_no_full', length: 128, nullable: true })
  prod_no_full: string | null;
  @Column({ name: 'category', length: 128, nullable: true })
  category: string | null;
  @Column({ name: 'is_sample', length: 255, nullable: true })
  is_sample: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'avg_price_tax_in', default: 0, transformer: NumericTransformer })
  avg_price_tax_in: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'avg_price_tax_out', default: 0, transformer: NumericTransformer })
  avg_price_tax_out: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'stock_amt_tax_in', default: 0, transformer: NumericTransformer })
  stock_amt_tax_in: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'stock_amt_tax_out', default: 0, transformer: NumericTransformer })
  stock_amt_tax_out: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'sale_price', default: 0, transformer: NumericTransformer })
  sale_price: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'sale_amt', default: 0, transformer: NumericTransformer })
  sale_amt: number;

  @Column({ name: 'season', length: 64, nullable: true })
  season: string | null;
  @Column({ name: 'color', length: 64, nullable: true })
  color: string | null;
  @Column({ name: 'size', length: 64, nullable: true })
  size: string | null;
  @Column({ name: 'style', length: 128, nullable: true })
  style: string | null;
  @Column({ name: 'season_inner', length: 64, nullable: true })
  season_inner: string | null;
  @Column({ name: 'skc_boutique', length: 255, nullable: true })
  skc_boutique: string | null;
  @Column({ name: 'spu_boutique', length: 255, nullable: true })
  spu_boutique: string | null;

  @CreateDateColumn({ name: 'snapshot_at' })
  snapshot_at: Date;
}
