import { get, post } from './http';
import type { Notification } from '@/types';

export const listNotifications = (
  params: Record<string, unknown>,
): Promise<{ items: Notification[]; total: number; unread: number }> =>
  get('/notifications', { params });

export const markRead = (id: number): Promise<null> =>
  post(`/notifications/${id}/read`);

export const markAllRead = (): Promise<null> => post('/notifications/read-all');
