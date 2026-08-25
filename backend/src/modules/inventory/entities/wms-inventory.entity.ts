import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WarehouseType } from '../../../common/constants/types';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

/** 通天晓 WMS 库存快照（按 WMS 模板的 18 列完整保留）。BR-03: stock = available + unsorted。 */
@Entity('wms_inventory')
@Index('idx_wms_batch_sku', ['batch_id', 'sku_code', 'warehouse'])
export class WmsInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_id' })
  batch_id: number;

  @Column({ name: 'row_no', type: 'int', nullable: true })
  row_no: number | null;

  @Column({ name: 'sku_code', length: 64 })
  sku_code: string;

  @Column({ type: 'varchar', length: 16 })
  warehouse: WarehouseType;

  @Column({ name: 'company_code', length: 64, nullable: true })
  company_code: string | null;

  @Column({ name: 'sku_name', length: 255, nullable: true })
  sku_name: string | null;

  @Column({ name: 'location_code', length: 128, nullable: true })
  location_code: string | null;

  @Column({ name: 'zone_code', length: 64, nullable: true })
  zone_code: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'stock_qty', transformer: NumericTransformer })
  stock_qty: number;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'in_transit_qty', default: 0, transformer: NumericTransformer })
  in_transit_qty: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'allocated_qty', default: 0, transformer: NumericTransformer })
  allocated_qty: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'locked_qty', default: 0, transformer: NumericTransformer })
  locked_qty: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'frozen_qty', default: 0, transformer: NumericTransformer })
  frozen_qty: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'available_qty', default: 0, transformer: NumericTransformer })
  available_qty: number;
  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'unsorted_qty', default: 0, transformer: NumericTransformer })
  unsorted_qty: number;

  @Column({ name: 'lot', length: 64, nullable: true })
  lot: string | null;
  @Column({ name: 'manufacture_date', type: 'date', nullable: true })
  manufacture_date: string | null;
  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expiration_date: string | null;
  @Column({ name: 'aging_date', type: 'date', nullable: true })
  aging_date: string | null;
  @Column({ name: 'attribute1', length: 64, nullable: true })
  attribute1: string | null;
  @Column({ name: 'inventory_sts', length: 64, nullable: true })
  inventory_sts: string | null;
  @Column({ name: 'lpn', length: 64, nullable: true })
  lpn: string | null;
  @Column({ name: 'shelf_life_sts', length: 64, nullable: true })
  shelf_life_sts: string | null;

  @CreateDateColumn({ name: 'snapshot_at' })
  snapshot_at: Date;
}
