import { get, post } from './http';
import type {
  DashboardSummary,
  TrendPoint,
  FormulaData,
  UnsortedItem,
  UnsortedPivotItem,
  ReturnsItem,
  ExpiryBucket,
  ExpiryAlert,
} from '@/types';

export const clearAllData = (): Promise<{
  ok: boolean;
  clearedTables: string[];
  clearedAt: string;
}> => post('/admin/clear-all', {});

export const getSummary = (warehouse?: string): Promise<DashboardSummary> =>
  get('/dashboard/summary', { params: { warehouse } });

export const getTrend = (params: Record<string, unknown>): Promise<TrendPoint[]> =>
  get('/dashboard/trend', { params });

export const getFormula = (warehouse?: string): Promise<FormulaData> =>
  get('/dashboard/formula', { params: { warehouse } });

export const listUnsorted = (
  params: Record<string, unknown>,
): Promise<{ items: UnsortedItem[]; total: number }> => get('/unsorted', { params });

export const listUnsortedPivot = (
  params: Record<string, unknown>,
): Promise<{ items: UnsortedPivotItem[]; total: number; totalQty: number }> =>
  get('/unsorted/pivot', { params });

export const getReturns = (
  params?: Record<string, unknown>,
): Promise<{ items: ReturnsItem[]; total: number }> =>
  get('/returns/transit', { params });

export const exportUnsorted = (
  params: Record<string, unknown>,
): Promise<string> => get('/unsorted/export', { params, responseType: 'text' } as never);

export const getExpiry = (): Promise<{
  buckets: ExpiryBucket[];
  items: ExpiryAlert[];
}> => get('/expiry/distribution');

/** 单表行数（admin 用）。 */
export const getTableCounts = (): Promise<Record<string, number>> =>
  get('/admin/table-counts');

/** 清空单表（admin 用，破坏性）。 */
export const clearTable = (
  table: string,
): Promise<{ ok: boolean; deleted: number; batchesDeleted: number; table: string; clearedAt: string }> =>
  post('/admin/clear-table', { table });
