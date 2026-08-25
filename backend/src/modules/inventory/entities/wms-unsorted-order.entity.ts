import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WarehouseType } from '../../../common/constants/types';
import { NumericTransformer } from '../../../common/transformers/numeric.transformer';

/**
 * WMS 未分拣出库单行（原样保留，供追溯）。
 * 对应真实模板「正常/临期仓未分拣.xlsx」：每行是一条出库单明细，
 * 同一 SKU 可能出现在多行，导入时再按货品编码聚合成未分拣量。
 */
@Entity('wms_unsorted_order')
@Index('idx_unsorted_batch_sku', ['batch_id', 'sku_code'])
export class WmsUnsortedOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_id' })
  batch_id: number;

  @Column({ type: 'varchar', length: 16 })
  warehouse: WarehouseType;

  @Column({ name: 'order_no', length: 64, nullable: true })
  order_no: string;

  @Column({ name: 'order_type', length: 16, nullable: true })
  order_type: string;

  @Column({ name: 'carrier_code', length: 64, nullable: true })
  carrier_code: string;

  @Column({ name: 'express_no', length: 64, nullable: true })
  express_no: string;

  @Column({ name: 'wave_no', length: 64, nullable: true })
  wave_no: string;

  @Column({ name: 'sku_code', length: 64 })
  sku_code: string;

  @Column({ name: 'sku_name', length: 255, nullable: true })
  sku_name: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty',
    transformer: NumericTransformer,
  })
  qty: number;

  @Column({ name: 'recipient', type: 'text', nullable: true })
  recipient: string;

  @Column({ name: 'province', length: 64, nullable: true })
  province: string;

  @Column({ name: 'city', length: 64, nullable: true })
  city: string;

  @Column({ name: 'district', length: 64, nullable: true })
  district: string;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string;

  @Column({ name: 'id_card', type: 'text', nullable: true })
  id_card: string;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  fail_reason: string;

  // 创建时间格式如 2026-01-01T14:06，避免时区转换统一存为字符串
  @Column({ name: 'created_at', length: 64, nullable: true })
  created_at: string;

  @CreateDateColumn({ name: 'imported_at' })
  imported_at: Date;
}
