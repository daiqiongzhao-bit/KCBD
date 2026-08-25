/**
 * 分页参数标准化：
 * - size 传 0 / undefined / 负数 → 返回 null（表示不分页、查全部）
 * - 其它情况限制在 [1, 500]，默认 20
 */
export function normalizePage(
  page?: number | string | null,
  size?: number | string | null,
  maxSize = 500,
): { page: number; size: number | null } {
  const p = Math.max(1, Number(page) || 1);
  const raw = Number(size);
  if (Number.isNaN(raw) || raw === 0 || raw < 0) {
    return { page: p, size: null };
  }
  return { page: p, size: Math.min(maxSize, Math.max(1, Math.floor(raw))) };
}
