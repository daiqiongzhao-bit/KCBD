import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { normalizePage } from '../../common/utils/pagination';

export interface NotifyInput {
  type: string;
  title: string;
  /** 站内消息正文（与 content 二选一）。 */
  message?: string;
  /** 兼容部分调用方使用 content 字段承载正文。 */
  content?: string;
  relatedId?: number;
  userId?: number;
  /** 关联 SKU（仅用于业务语义，不落库）。 */
  skuCode?: string;
  /** 关联的對账记录 id（映射到 related_id）。 */
  reconcileId?: number;
}

@Injectable()
export class NotifyService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async create(input: NotifyInput): Promise<Notification> {
    return this.repo.save(
      this.repo.create({
        type: input.type,
        title: input.title,
        message: input.message ?? input.content ?? '',
        related_id: (input.reconcileId ?? input.relatedId) ?? null,
        user_id: input.userId ?? null,
        is_read: false,
      }),
    );
  }

  /**
   * 幂等创建通知（P1-4）：重复对账时避免重复通知。
   * - 有 relatedId：按 (type, related_id) 查重；
   * - 无 relatedId：按 (type, title, message) 查重。
   * 已存在则跳过并返回 null。
   */
  async createIfAbsent(input: NotifyInput): Promise<Notification | null> {
    const relatedId = (input.reconcileId ?? input.relatedId) ?? null;
    const where =
      relatedId !== null
        ? { type: input.type, related_id: relatedId }
        : {
            type: input.type,
            title: input.title,
            message: input.message ?? input.content ?? '',
          };
    const existing = await this.repo.findOne({ where });
    if (existing) return null;
    return this.create(input);
  }

  async list(query: { page?: number; size?: number; unreadOnly?: boolean }) {
    const { page, size } = normalizePage(query.page, query.size, 200);
    const qb = this.repo.createQueryBuilder('n');
    if (query.unreadOnly) qb.where('n.is_read = false');
    qb.orderBy('n.created_at', 'DESC');
    if (size !== null) qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    const unread = await this.repo.count({ where: { is_read: false } });
    return { items, total, unread };
  }

  async markRead(id: number): Promise<void> {
    const n = await this.repo.findOne({ where: { id } });
    if (n) {
      n.is_read = true;
      await this.repo.save(n);
    }
  }

  /**
   * 标记当前用户所有未读通知为已读。
   * 通知目前为全局广播（user_id 多为 null），因此把全部未读置为已读。
   */
  async markAllRead(userId?: number): Promise<void> {
    const qb = this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ is_read: true })
      .where('is_read = false');
    if (userId) {
      qb.andWhere('(user_id = :uid OR user_id IS NULL)', { uid: userId });
    }
    await qb.execute();
  }
}
