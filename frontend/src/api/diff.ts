import { get, post } from './http';
import type { InventoryReconcile, DiffHandling, PageResult } from '@/types';

export const listDiff = (params: Record<string, unknown>): Promise<PageResult<InventoryReconcile>> =>
  get('/diff-handling', { params });

export const getDiffTimeline = (
  reconcileId: number,
): Promise<{ reconcileId: number; timeline: DiffHandling[] }> =>
  get(`/diff-handling/${reconcileId}`);

export const handleDiff = (
  reconcileId: number,
  body: { cause?: string; note?: string; status?: string },
): Promise<DiffHandling> => post(`/diff-handling/${reconcileId}`, body);

/** 批量标注 / 改状态。 */
export const handleDiffBatch = (
  ids: number[],
  body: { cause?: string; note?: string; status?: string },
): Promise<{ ok: number; fail: number; skipped: number }> =>
  post('/diff-handling/batch', { ids, ...body });
