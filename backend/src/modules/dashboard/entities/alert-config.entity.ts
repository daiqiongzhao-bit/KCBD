import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 告警 / 容差配置（P1-09 / P2-03）。 */
@Entity('alert_configs')
@Index('uq_alert_key', ['key', 'scope'], { unique: true })
export class AlertConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  key: string;

  @Column({ length: 64, nullable: true })
  value: string;

  @Column({ length: 32, default: 'global' })
  scope: string;
}
