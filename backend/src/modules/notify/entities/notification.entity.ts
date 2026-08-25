import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 站内通知（P1 R-P1-05）。 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  user_id: number;

  @Column({ length: 32 })
  type: string;

  @Column({ length: 128 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'related_id', nullable: true })
  related_id: number;

  @Column({ name: 'is_read', default: false })
  is_read: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
