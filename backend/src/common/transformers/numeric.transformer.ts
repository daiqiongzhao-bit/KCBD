import { ValueTransformer } from 'typeorm';

/**
 * NUMERIC(precision, scale) 在 PostgreSQL 驱动中返回字符串，
 * 通过该转换器在实体层统一以 number 处理，避免浮点误差与类型错乱。
 */
export const NumericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => {
    // undefined（未提供）→ 保持 undefined，让 TypeORM 跳过该列使用 DB 默认值（default: 0），
    // 避免把 undefined 转成 null 后违反 NOT NULL 约束。
    if (value === undefined) return undefined;
    if (value === null) return null;
    return Number(value);
  },
  from: (value?: string | number | null): number | null => {
    if (value === null || value === undefined || value === '') return null;
    return typeof value === 'number' ? value : parseFloat(value);
  },
};
