import { SourceType, WarehouseType } from '../../../common/constants/types';

export interface Issue {
  row: number;
  field: string;
  reason: string;
}

/** 解析为数字；空或非数字返回 NaN。 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(String(value).replace(/,/g, ''));
  return n;
}

/** 归一化仓库类型：normal/expired，兼容中文。 */
export function normalizeWarehouse(value: string): WarehouseType | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'normal' || v === '正常' || v === '常规') return 'normal';
  if (v === 'expired' || v === '临期' || v === '过期') return 'expired';
  return null;
}

/** SKU 编码格式校验：非空且长度 1~64（兼容字母/数字/中文/符号等真实 SKU）。 */
export function isValidSku(value: string): boolean {
  const s = String(value).trim();
  return s.length > 0 && s.length <= 64;
}

/** 解析赠品生效日期（字符串/Date → YYYY-MM-DD 或 null）。 */
export function parseEffectiveDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    // 使用本地时区组件拼接，避免 toISOString()（UTC）导致跨时区日期前移一天
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
}

export const WAREHOUSE_ENUM: WarehouseType[] = ['normal', 'expired'];
export const SOURCE_ENUM: SourceType[] = ['eop', 'wms', 'gift'];
