import { get, post } from './http';
import type { PreviewResult, UploadBatch, PageResult } from '@/types';

export const previewUpload = (
  file: File,
  source: string,
  warehouse?: string | null,
  mapping?: Record<string, string>,
): Promise<PreviewResult> => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('source', source);
  if (warehouse) fd.append('warehouse', warehouse);
  if (mapping) fd.append('mapping', JSON.stringify(mapping));
  return post('/uploads/preview', fd, { timeout: 120000 });
};

export const confirmUpload = (
  file: File,
  source: string,
  mapping: Record<string, string>,
  opts?: { force?: boolean; batchName?: string; warehouse?: string | null; isGift?: boolean },
): Promise<{
  idempotent: boolean;
  batch: UploadBatch;
  rowsValid: number;
  rowsInvalid: number;
  issueCount: number;
  reconcileSummary: { total: number; match: number; diff: number; more: number; less: number } | null;
}> => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('source', source);
  fd.append('mapping', JSON.stringify(mapping));
  if (opts?.force) fd.append('force', 'true');
  if (opts?.batchName) fd.append('batchName', opts.batchName);
  if (opts?.warehouse) fd.append('warehouse', opts.warehouse);
  if (opts?.isGift !== undefined) fd.append('isGift', opts.isGift ? 'true' : 'false');
  // 大文件导入放宽到 10 分钟（chunk=1000 批量插入）
  return post('/uploads', fd, { timeout: 600000 });
};

export const listBatches = (params: Record<string, unknown>): Promise<PageResult<UploadBatch>> =>
  get('/uploads', { params });

export const getBatch = (id: number): Promise<UploadBatch> => get(`/uploads/${id}`);
