import { SourceType } from '../../../common/constants/types';
import {
  Issue,
  isValidSku,
  normalizeWarehouse,
  parseEffectiveDate,
  toNumber,
} from './rules';
import { REQUIRED_FIELDS } from '../field-mapping.service';

/** 模板中文表头 → 实体字段名（EOP：覆盖模板的 36 列）。 */
const EOP_HEADER_TO_FIELD: Record<string, string> = {
  行号: 'row_no',
  商品条码: 'barcode',
  中文名称: 'sku_name',
  '中文名称-全称': 'sku_name_full',
  英文名称: 'english_name',
  商品规格: 'spec',
  '规格-全称': 'spec_full',
  商品新分类: 'category_new',
  品牌: 'brand',
  门店: 'store',
  店面: 'sub_store',
  柜组: 'counter',
  大类: 'big_class',
  供应商: 'supplier',
  经营方式: 'business_mode',
  厂商货号: 'prod_no',
  '厂商货号-全称': 'prod_no_full',
  类别: 'category',
  是否样品: 'is_sample',
  平均含税进价: 'avg_price_tax_in',
  平均不含税进价: 'avg_price_tax_out',
  库存含税进价金额: 'stock_amt_tax_in',
  库存不含税进价金额: 'stock_amt_tax_out',
  售价: 'sale_price',
  售价金额: 'sale_amt',
  适用季节: 'season',
  花色: 'color',
  尺码: 'size',
  款式: 'style',
  内部季节: 'season_inner',
  'SKC精品': 'skc_boutique',
  'SPU精品': 'spu_boutique',
};

/** 模板英文表头 → 实体字段名（WMS：覆盖模板的 18 列）。 */
const WMS_HEADER_TO_FIELD: Record<string, string> = {
  companyCode: 'company_code',
  name: 'sku_name',
  locationCode: 'location_code',
  zoneCode: 'zone_code',
  inTransitQty: 'in_transit_qty',
  allocatedQty: 'allocated_qty',
  lockedQty: 'locked_qty',
  frozenQty: 'frozen_qty',
  lot: 'lot',
  manufactureDate: 'manufacture_date',
  expirationDate: 'expiration_date',
  agingDate: 'aging_date',
  attribute1: 'attribute1',
  inventorySts: 'inventory_sts',
  lpn: 'lpn',
  shelfLifeSts: 'shelf_life_sts',
};

const EXTRA_HEADER_MAP: Record<SourceType, Record<string, string>> = {
  eop: EOP_HEADER_TO_FIELD,
  wms: WMS_HEADER_TO_FIELD,
  gift: {},
  unsorted: {},
};

/** 核心数值字段：原值→字符串后由 upload.service 转 number 写入实体。 */
const EXTRA_NUMERIC_FIELDS = new Set([
  'row_no',
  'avg_price_tax_in', 'avg_price_tax_out',
  'stock_amt_tax_in', 'stock_amt_tax_out',
  'sale_price', 'sale_amt',
]);

const NUMERIC_FIELDS = new Set([
  'in_transit_qty', 'allocated_qty', 'locked_qty', 'frozen_qty',
]);

export interface EopCoreFields {
  sku_code: string;
  sku_name: string;
  warehouse: 'normal' | 'expired';
  stock_qty: number;
  actual_qty: number;
  return_qty: number;
}
export interface WmsCoreFields {
  sku_code: string;
  sku_name: string;
  warehouse: 'normal' | 'expired';
  stock_qty: number;
  unsorted_qty: number;
  expiration_date?: string | null;
}
export interface EopValidRow extends EopCoreFields {
  /** 模板全列透传（除核心 6 字段外的其余 EOP 模板列）。 */
  extras: Record<string, string | number | null | undefined>;
}
export interface WmsValidRow extends WmsCoreFields {
  row_no?: number;
  extras: Record<string, string | number | null | undefined>;
}
export interface GiftValidRow {
  sku_code: string;
  sku_name: string;
  effective_date: string | null;
}
export type ValidRow = EopValidRow | WmsValidRow | GiftValidRow;
export interface ValidationResult {
  valid: ValidRow[];
  issues: Issue[];
}

/** 从原 row 按 EOP/WMS 全列映射表提取额外字段。 */
function extractExtras(
  source: SourceType,
  row: Record<string, string>,
  templateHeaders: string[],
): Record<string, string | number | null | undefined> {
  const map = EXTRA_HEADER_MAP[source] || {};
  const out: Record<string, string | number | null | undefined> = {};
  for (const h of templateHeaders) {
    const field = map[h];
    if (!field) continue;
    const raw = row[h];
    if (raw === undefined) continue;
    const trimmed = String(raw).trim();
    if (field === 'row_no') {
      const n = parseInt(trimmed, 10);
      out[field] = isNaN(n) ? null : n;
    } else if (EXTRA_NUMERIC_FIELDS.has(field) || NUMERIC_FIELDS.has(field)) {
      const n = parseFloat(trimmed);
      out[field] = isNaN(n) ? null : n;
    } else {
      out[field] = trimmed || null;
    }
  }
  return out;
}

/**
 * 逐行校验链：字段完整性 → 类型 → SKU 格式 → 仓库枚举。
 * mapping: 模板核心字段 -> 源表头；templateHeaders: 模板全表头（用于全列透传）。
 */
export class RowValidator {
  static validate(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    source: SourceType,
    warehouse?: 'normal' | 'expired' | null,
    templateHeaders: string[] = [],
  ): ValidationResult {
    const issues: Issue[] = [];
    const valid: ValidRow[] = [];

    rows.forEach((row, idx) => {
      const rowNo = idx + 1;
      const required = REQUIRED_FIELDS[source];
      const getVal = (field: string): string => {
        const header = mapping[field];
        return header ? (row[header] ?? '') : '';
      };

      const missingField = required.find((f) => !mapping[f]);
      if (missingField) {
        issues.push({
          row: rowNo,
          field: missingField,
          reason: `缺少字段「${missingField}」的映射`,
        });
        return;
      }

      const sku = getVal('sku_code').trim();
      if (!sku) {
        issues.push({ row: rowNo, field: 'sku_code', reason: 'SKU 编码为空' });
        return;
      }
      if (!isValidSku(sku)) {
        issues.push({
          row: rowNo,
          field: 'sku_code',
          reason: `SKU 编码格式非法：${sku}`,
        });
        return;
      }

      let wh: 'normal' | 'expired' | null = null;
      if (source !== 'gift') {
        const columnVal = getVal('warehouse');
        wh = columnVal
          ? normalizeWarehouse(columnVal)
          : (warehouse ?? null);
        if (!wh) {
          issues.push({
            row: rowNo,
            field: 'warehouse',
            reason: '未指定仓库类型（模板无该列时需在导入页选择）',
          });
          return;
        }
      }

      const extras = extractExtras(source, row, templateHeaders);

      if (source === 'eop') {
        const stock = toNumber(getVal('stock_qty'));
        const actual = toNumber(getVal('actual_qty'));
        const ret = getVal('return_qty') ? toNumber(getVal('return_qty')) : 0;
        if (isNaN(stock) || isNaN(actual) || isNaN(ret)) {
          issues.push({
            row: rowNo,
            field: 'stock_qty',
            reason: '数量字段存在非数字',
          });
          return;
        }
        // 行号：模板里有就用模板值，否则用数据顺序
        if (extras.row_no == null) extras.row_no = rowNo;
        valid.push({
          sku_code: sku,
          sku_name: getVal('sku_name').trim(),
          warehouse: wh as 'normal' | 'expired',
          stock_qty: stock,
          actual_qty: actual,
          return_qty: ret,
          extras,
        });
      } else if (source === 'wms') {
        const rawStock = getVal('stock_qty');
        const rawUnsorted = getVal('unsorted_qty');
        const stock = rawStock ? toNumber(rawStock) : 0;
        const unsorted = rawUnsorted ? toNumber(rawUnsorted) : 0;
        if (rawStock && isNaN(stock)) {
          issues.push({ row: rowNo, field: 'stock_qty', reason: '库存数量非数字' });
          return;
        }
        if (rawUnsorted && isNaN(unsorted)) {
          issues.push({ row: rowNo, field: 'unsorted_qty', reason: '未分拣数量非数字' });
          return;
        }
        if (!rawStock && !rawUnsorted) {
          issues.push({
            row: rowNo,
            field: 'stock_qty',
            reason: '库存数量与未分拣数量均为空',
          });
          return;
        }
        const expiration_date = getVal('expiration_date').trim() || null;
        if (extras.expiration_date == null) extras.expiration_date = expiration_date;
        valid.push({
          sku_code: sku,
          sku_name: getVal('sku_name').trim(),
          warehouse: wh as 'normal' | 'expired',
          stock_qty: stock,
          unsorted_qty: unsorted,
          row_no: (extras.row_no as number | null) ?? rowNo,
          extras,
        });
      } else {
        const eff = parseEffectiveDate(getVal('effective_date'));
        valid.push({
          sku_code: sku,
          sku_name: getVal('sku_name').trim(),
          effective_date: eff,
        });
      }
    });

    return { valid, issues };
  }
}
