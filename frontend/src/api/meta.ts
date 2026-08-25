import { get } from './http';

export const getVersion = (): Promise<{ version: string }> =>
  get('/meta/version');
