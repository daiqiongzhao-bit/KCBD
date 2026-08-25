import { EopInventory } from '../../inventory/entities/eop-inventory.entity';
import { WmsInventory } from '../../inventory/entities/wms-inventory.entity';
import { WarehouseType } from '../../../common/constants/types';

/**
 * 对账聚合辅助（修复取值 bug 核心）。
 *
 * 旧逻辑：引擎用 Map<sku, singleRow>，同一 SKU 出现多行（多库位/多行导入）
 * 时只保留最后一行，导致 EOP/WMS 仅取一条、合计失真。
 *
 * 新逻辑：先按 sku 聚合 SUM 各数量字段；未分拣量额外叠加来自
 * wms_unsorted_order 明细表的聚合（key = `${sku}|${warehouse}`）。
 */

export interface EopAgg {
  stock: number;
  actual: number;
  return: number;
  sku_name: string;
  warehouse?: WarehouseType;
}

export interface WmsAgg {
  stock: number;
  available: number;
  unsorted: number;
  sku_name: string;
  warehouse?: WarehouseType;
}

export function aggregateEop(rows: EopInventory[]): Map<string, EopAgg> {
  const m = new Map<string, EopAgg>();
  for (const r of rows) {
    const a =
      m.get(r.sku_code) ||
      ({ stock: 0, actual: 0, return: 0, sku_name: '', warehouse: undefined } as EopAgg);
    a.stock += Number(r.stock_qty) || 0;
    a.actual += Number(r.actual_qty) || 0;
    a.return += Number(r.return_qty) || 0;
    if (r.sku_name && !a.sku_name) a.sku_name = r.sku_name;
    if (r.warehouse && !a.warehouse) a.warehouse = r.warehouse;
    m.set(r.sku_code, a);
  }
  return m;
}

/**
 * @param rows        wms_inventory 行（标准模板导入）
 * @param unsortedMap 来自 wms_unsorted_order 的未分拣量，key = `${sku}|${warehouse}`
 *                     未分拣模板导入只入明细表、不写 wms_inventory，因此其 unsorted
 *                     量必须通过此 map 叠加，否则对账页 WMS 未分拣恒为 0。
 */
export function aggregateWms(
  rows: WmsInventory[],
  unsortedMap?: Map<string, number>,
): Map<string, WmsAgg> {
  const m = new Map<string, WmsAgg>();
  for (const r of rows) {
    const a =
      m.get(r.sku_code) ||
      ({ stock: 0, available: 0, unsorted: 0, sku_name: '', warehouse: undefined } as WmsAgg);
    a.stock += Number(r.stock_qty) || 0;
    a.available += Number(r.available_qty) || 0;
    a.unsorted += Number(r.unsorted_qty) || 0;
    if (r.sku_name && !a.sku_name) a.sku_name = r.sku_name;
    if (r.warehouse && !a.warehouse) a.warehouse = r.warehouse;
    m.set(r.sku_code, a);
  }

  if (unsortedMap && unsortedMap.size > 0) {
    for (const [key, qty] of unsortedMap) {
      const [sku] = key.split('|');
      // 只叠加到 wms_inventory 中已存在的 SKU（m.has(sku)）。
      // 仅存在于未分拣表、无 WMS 库存记录的 SKU 不参与对账：
      // 否则 aggregateWms(空行, unsortedMap) 会把未分拣 SKU 凭空加入 wmsAgg，
      // 导致 normal/expired/gift 各分支都生成错位对账行（跨仓库/跨分支污染）。
      const a = m.get(sku);
      if (!a) continue;
      a.unsorted += Number(qty) || 0;
    }
  }

  // 关键一致性修正（C120144 回归根因）：
  // 未分拣量叠加后，可用库存必须同步扣减 —— available = stock - unsorted。
  // 否则 wms_available 仍是未扣减的 stock（313），而 unsorted 叠加了 47，
  // 导致 diff_value = eopActual + unsorted - wmsTotal = 0（正确，一致）
  // 但 diff_value_actual = eopActual - wms_available = -47（错误，超容差），
  // classifyDiff 因 rateActual 超容差把「一致」误标为「差异/多」。
  // 修正后 diff_value_actual 与 diff_value 口径一致，不再误判。
  for (const a of m.values()) {
    a.available = Math.max(0, a.stock - a.unsorted);
  }
  return m;
}
