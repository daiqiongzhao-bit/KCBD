import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SourceType } from '../../../common/constants/types';

/** 导入批次记录（R-P0-06 幂等：source + content_hash 唯一）。 */
@Entity('upload_batches')
@Index('uq_batch_idempotent', ['source', 'content_hash'], { unique: true })
export class UploadBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16 })
  source: SourceType;

  @Column({ name: 'file_name', length: 255, nullable: true })
  file_name: string;

  @Column({ name: 'content_hash', length: 64 })
  content_hash: string;

  @Column({ name: 'uploader_id', nullable: true })
  uploader_id: number;

  @Column({ name: 'batch_name', length: 128, nullable: true })
  batch_name: string;

  @Column({ name: 'row_count', default: 0 })
  row_count: number;

  @Column({ name: 'rows_valid', default: 0 })
  rows_valid: number;

  @Column({ name: 'rows_invalid', default: 0 })
  rows_invalid: number;

  @Column({ length: 16, default: 'pending' })
  status: string;

  /** 是否赠品批次（赠品文件导入时标记，对账按此区分正常商品/赠品基准批次）。 */
  @Column({ name: 'is_gift', default: false })
  is_gift: boolean;

  @Column({ type: 'jsonb', nullable: true })
  error_summary: unknown;

  @CreateDateColumn({ name: 'imported_at' })
  imported_at: Date;
}
