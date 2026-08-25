import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 操作日志（P1 R-P1-06）。 */
@Entity('operation_logs')
@Index('idx_op_log_user', ['user_id', 'created_at'])
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  user_id: number;

  @Column({ length: 64 })
  action: string;

  @Column({ name: 'target', length: 128, nullable: true })
  target: string;

  @Column({ type: 'jsonb', nullable: true })
  detail: unknown;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
