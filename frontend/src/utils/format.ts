/** 将日期格式化为 YYYY-MM-DD。 */
const pad = (n: number): string => String(n).padStart(2, '0');

const toDate = (v: string | number | Date | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export const formatNumber = (v: number | null | undefined, d = 2): string => {
  if (v === null || v === undefined || isNaN(v)) return '-';
  return Number(v).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

export const formatPercent = (v: number | null | undefined, d = 2): string => {
  if (v === null || v === undefined || isNaN(v)) return '-';
  return (v * 100).toFixed(d) + '%';
};

export const formatDate = (v: string | null | undefined): string => {
  const d = toDate(v);
  if (!d) return '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDateTime = (v: string | null | undefined): string => {
  const d = toDate(v);
  if (!d) return '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
