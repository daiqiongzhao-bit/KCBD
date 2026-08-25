import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DiffType, ReconcileStatus, WarehouseType } from '../../../common/constants/types';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

/** 对账结果（BR-06~13）。 */
@Entity('inventory_reconcile')
@Index(
  'uq_reconcile',
  ['sku_code', 'warehouse', 'eop_batch_id', 'wms_batch_id'],
  { unique: true },
)
export class InventoryReconcile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'eop_batch_id', nullable: true })
  eop_batch_id: number;

  @Column({ name: 'wms_batch_id', nullable: true })
  wms_batch_id: number;

  @Column({ name: 'sku_code', length: 64 })
  sku_code: string;

  @Column({ name: 'sku_name', length: 255, nullable: true })
  sku_name: string | null;

  @Column({ type: 'varchar', length: 16 })
  warehouse: WarehouseType;

  @Column({ name: 'is_gift', default: false })
  is_gift: boolean;

  @Column({ name: 'cleared', default: false })
  cleared: boolean;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'eop_stock',
    transformer: NumericTransformer,
  })
  eop_stock: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'eop_actual',
    transformer: NumericTransformer,
  })
  eop_actual: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'eop_return',
    transformer: NumericTransformer,
  })
  eop_return: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'wms_total',
    transformer: NumericTransformer,
  })
  wms_total: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'wms_available',
    transformer: NumericTransformer,
  })
  wms_available: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'wms_unsorted',
    transformer: NumericTransformer,
  })
  wms_unsorted: number;

  /** diff_value = eop_stock - wms_total（BR-06） */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'diff_value',
    transformer: NumericTransformer,
  })
  diff_value: number;

  /** diff_value_actual = eop_actual - wms_available（BR-07） */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    name: 'diff_value_actual',
    transformer: NumericTransformer,
  })
  diff_value_actual: number;

  /** diff_rate = diff_value / NULLIF(eop_stock, 0) */
  @Column({
    type: 'numeric',
    precision: 9,
    scale: 4,
    nullable: true,
    name: 'diff_rate',
    transformer: NumericTransformer,
  })
  diff_rate: number;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  diff_type: DiffType;

  @Column({ name: 'possible_cause', length: 64, nullable: true })
  possible_cause: string;

  @Column({ type: 'varchar', length: 16, default: 'match' })
  status: ReconcileStatus;

  @CreateDateColumn({ name: 'reconciled_at' })
  reconciled_at: Date;
}
