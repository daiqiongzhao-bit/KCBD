import { DiffType, ReconcileStatus } from '../../../common/constants/types';

export interface ClassifyInput {
  diffValue: number;
  diffValueActual: number;
  eopStock: number;
  eopActual: number;
  wmsAvailable: number;
  wmsUnsorted: number;
  tolerance: number; // 数量百分比，例如 0.005
}

export interface ClassifyResult {
  status: ReconcileStatus;
  diffType: DiffType;
  possibleCause: string;
}

/**
 * 差异分类器（BR-10~13）。
 * - 先按 diffValue 与 diffValueActual 的绝对值/比率判断是否在容差内 → match（一致）
 * - 否则按 diffValue 的正负区分「多 / 少」：
 *     diffValue > 0 → 多（账面 EOP 实际 + 未分拣 比 WMS 库存多）
 *     diffValue < 0 → 少（账面 EOP 实际 + 未分拣 比 WMS 库存少）
 * 不再使用「时间差」分类：多就是多，少就是少。
 */
export function classifyDiff(input: ClassifyInput): ClassifyResult {
  const { diffValue, diffValueActual, eopStock, eopActual, tolerance } = input;

  const base = Math.abs(eopStock) || 1;
  const rate = Math.abs(diffValue) / base;
  const baseActual = Math.abs(eopActual) || 1;
  const rateActual = Math.abs(diffValueActual) / baseActual;

  if (rate <= tolerance && rateActual <= tolerance) {
    return { status: 'match', diffType: 'none', possibleCause: '一致' };
  }

  // 多就是多，少就是少：直接按差异值方向定性，不再区分「时间差」。
  if (diffValue > 0) {
    return {
      status: 'diff',
      diffType: 'more',
      possibleCause: 'EOP 实际库存 + WMS 未分拣 > WMS 库存，账面比实物多',
    };
  }
  if (diffValue < 0) {
    return {
      status: 'diff',
      diffType: 'less',
      possibleCause: 'EOP 实际库存 + WMS 未分拣 < WMS 库存，账面比实物少',
    };
  }
  return { status: 'diff', diffType: 'more', possibleCause: '其他差异' };
}
