import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DiffCause } from '../../../common/constants/types';

/** 差异处理 / 审计时间线（P1 R-P1-01/02）。 */
@Entity('diff_handling')
@Index('idx_diff_handling_reconcile', ['reconcile_id'])
export class DiffHandling {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reconcile_id' })
  reconcile_id: number;

  @Column({ length: 16, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 16, default: 'unset' })
  cause: DiffCause;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'operator_id', nullable: true })
  operator_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
