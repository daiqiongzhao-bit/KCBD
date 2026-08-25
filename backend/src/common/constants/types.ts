/** 仓库类型 */
export type WarehouseType = 'normal' | 'expired';

/** 数据来源 */
export type SourceType = 'eop' | 'wms' | 'gift' | 'unsorted';

/** 对账状态（一致 / 差异，不再区分时间差） */
export type ReconcileStatus = 'match' | 'diff';

/** 差异类型（多 / 少，基于差异值正负方向） */
export type DiffType = 'more' | 'less' | 'none';

/** 差异可能原因 */
export type DiffCause =
  | 'missing_inbound'
  | 'missing_outbound'
  | 'time_gap'
  | 'other'
  | 'unset';

/** 导入批次状态 */
export type BatchStatus = 'pending' | 'success' | 'failed';

/** 差异处理状态 */
export type HandleStatus = 'pending' | 'processing' | 'resolved';
