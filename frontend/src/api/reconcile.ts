import { get, post, del } from './http';
import type { InventoryReconcile, PageResult, RunSummary } from '@/types';

export const runReconcile = (body: {
  eopBatchId?: number;
  wmsBatchId?: number;
  warehouse?: string;
  tolerance?: number;
}): Promise<RunSummary> => post('/reconcile/run', body);

export const listReconcile = (params: Record<string, unknown>): Promise<PageResult<InventoryReconcile>> =>
  get('/reconcile', { params });

export const getReconcile = (
  id: number,
): Promise<InventoryReconcile & { formula: Record<string, number>; bothSides: Record<string, unknown> }> =>
  get(`/reconcile/${id}`);

export const clearReference = (
  id: number,
): Promise<{ id: number; cleared: boolean }> => post(`/reconcile/${id}/clear-reference`);

/** 清空全部对账数据。 */
export const clearAllReconcile = (
  warehouse?: string,
): Promise<{ deleted: number }> =>
  del('/reconcile', { params: warehouse ? { warehouse } : {} });

export const exportReconcile = (params: Record<string, unknown>): Promise<Blob> =>
  get('/reconcile/export', { params, responseType: 'blob' }) as unknown as Promise<Blob>;

export const giftReconcile = (params: Record<string, unknown>): Promise<PageResult<InventoryReconcile>> =>
  get('/reconcile/gift', { params });

export interface ReportDetail {
  sku_code: string;
  sku_name: string;
  is_gift: boolean;
  diff_value: number;
  diff_value_actual: number;
  diff_type: string;
  possible_cause: string;
  reconciled_at: string;
}

export interface ReportData {
  total: number;
  match: number;
  more: number;
  less: number;
  matchRate: number;
  batchId: number | null;
  detail: ReportDetail[];
}

export const getReport = (warehouse?: string): Promise<ReportData> =>
  get('/reconcile/report', { params: warehouse ? { warehouse } : {} });
