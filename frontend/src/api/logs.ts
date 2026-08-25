import { get } from './http';
import type { OperationLog, PageResult } from '@/types';

export const listLogs = (params: Record<string, unknown>): Promise<PageResult<OperationLog>> =>
  get('/operation-logs', { params });
