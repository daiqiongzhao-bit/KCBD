import { EopInventory } from '../../inventory/entities/eop-inventory.entity';
import { WmsInventory } from '../../inventory/entities/wms-inventory.entity';

export interface GiftSplitResult {
  giftEop: EopInventory[];
  giftWms: WmsInventory[];
  normalEop: EopInventory[];
  normalWms: WmsInventory[];
  expiredGiftWarnings: { sku_code: string; reason: string }[];
}

/**
 * 赠品拆分引擎（BR-14）。
 * 根据 products.is_gift 或 gift_skus 识别赠品 SKU，
 * 将 EOP/WMS 快照拆分为赠品/非赠品两个子集。
 * 临期仓出现赠品即时告警（BR-15）。
 */
export function splitByGift(
  eopRows: EopInventory[],
  wmsRows: WmsInventory[],
  giftSet: Set<string>,
): GiftSplitResult {
  const giftEop: EopInventory[] = [];
  const giftWms: WmsInventory[] = [];
  const normalEop: EopInventory[] = [];
  const normalWms: WmsInventory[] = [];
  const expiredGiftWarnings: { sku_code: string; reason: string }[] = [];

  for (const row of eopRows) {
    if (giftSet.has(row.sku_code)) {
      giftEop.push(row);
      if (row.warehouse === 'expired') {
        expiredGiftWarnings.push({
          sku_code: row.sku_code,
          reason: '临期仓出现赠品（EOP）',
        });
      }
    } else {
      normalEop.push(row);
    }
  }

  for (const row of wmsRows) {
    if (giftSet.has(row.sku_code)) {
      giftWms.push(row);
      if (row.warehouse === 'expired') {
        expiredGiftWarnings.push({
          sku_code: row.sku_code,
          reason: '临期仓出现赠品（WMS）',
        });
      }
    } else {
      normalWms.push(row);
    }
  }

  return { giftEop, giftWms, normalEop, normalWms, expiredGiftWarnings };
}
