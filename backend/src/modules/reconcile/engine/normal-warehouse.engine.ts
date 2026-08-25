import { EopInventory } from '../../inventory/entities/eop-inventory.entity';
import { WmsInventory } from '../../inventory/entities/wms-inventory.entity';
import { InventoryReconcile } from '../entities/inventory-reconcile.entity';
import { classifyDiff } from './diff-classifier';
import { aggregateEop, aggregateWms } from './aggregate.helper';

export interface ReconcileRowInput {
  eopRows: EopInventory[];
  wmsRows: WmsInventory[];
  eopBatchId: number;
  wmsBatchId: number;
  tolerance: number;
  isGift: boolean;
  /** 来自 wms_unsorted_order 的未分拣量，key=`${sku}|${warehouse}`。 */
  unsortedMap?: Map<string, number>;
}

/**
 * 正常仓对账引擎（R-P0-07）。
 * 等式：
 *   WMS(available + unsorted) == EOP(stock)
 *   WMS(available) ≈ EOP(actual_qty)
 *
 * 同一 SKU 可能在库存快照中存在多行（多库位/多行导入），必须按 sku 聚合 SUM，
 * 切勿只取一行（旧实现用 Map 覆盖导致取值错误）。
 */
export function reconcileNormalWarehouse(
  input: ReconcileRowInput,
): InventoryReconcile[] {
  return reconcileWarehouse(input);
}

function reconcileWarehouse(input: ReconcileRowInput): InventoryReconcile[] {
  const { eopRows, wmsRows, eopBatchId, wmsBatchId, tolerance, isGift, unsortedMap } = input;

  const eopAgg = aggregateEop(eopRows);
  const wmsAgg = aggregateWms(wmsRows, unsortedMap);

  const allSkus = new Set([...eopAgg.keys(), ...wmsAgg.keys()]);
  const results: InventoryReconcile[] = [];

  for (const sku of allSkus) {
    const eop = eopAgg.get(sku);
    const wms = wmsAgg.get(sku);
    const warehouse = (eop?.warehouse || wms?.warehouse || 'normal') as any;

    const eopStock = eop ? eop.stock : 0;
    const eopActual = eop ? eop.actual : 0;
    const eopReturn = eop ? eop.return : 0;
    const wmsTotal = wms ? wms.stock : 0;
    const wmsAvailable = wms ? wms.available : 0;
    const wmsUnsorted = wms ? wms.unsorted : 0;

    const diffValue = eopActual + wmsUnsorted - wmsTotal;
    const diffValueActual = eopActual - wmsAvailable;
    const diffRate = eopStock === 0 ? 0 : diffValue / eopStock;

    const classified = classifyDiff({
      diffValue,
      diffValueActual,
      eopStock,
      eopActual,
      wmsAvailable,
      wmsUnsorted,
      tolerance,
    });

    const skuName = eop?.sku_name || wms?.sku_name || '';

    const result = new InventoryReconcile();
    result.eop_batch_id = eopBatchId;
    result.wms_batch_id = wmsBatchId;
    result.sku_code = sku;
    result.sku_name = skuName;
    result.warehouse = warehouse;
    result.is_gift = isGift;
    result.eop_stock = eopStock;
    result.eop_actual = eopActual;
    result.eop_return = eopReturn;
    result.wms_total = wmsTotal;
    result.wms_available = wmsAvailable;
    result.wms_unsorted = wmsUnsorted;
    result.diff_value = diffValue;
    result.diff_value_actual = diffValueActual;
    result.diff_rate = diffRate;
    result.diff_type = classified.diffType;
    result.possible_cause = classified.possibleCause;
    result.status = classified.status;

    results.push(result);
  }

  return results;
}
