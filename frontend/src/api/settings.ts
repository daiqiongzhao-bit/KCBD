import { get, put } from './http';
import type { AlertSettings } from '@/types';

export const getTolerance = (): Promise<{ diffRateTolerance: number }> =>
  get('/settings/tolerance');

export const putTolerance = (v: number): Promise<{ diffRateTolerance: number }> =>
  put('/settings/tolerance', { diffRateTolerance: v });

export const getAlerts = (): Promise<AlertSettings> => get('/settings/alerts');

export const putAlerts = (body: Partial<AlertSettings>): Promise<AlertSettings> =>
  put('/settings/alerts', body);
