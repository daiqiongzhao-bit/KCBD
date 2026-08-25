import { Injectable } from '@nestjs/common';
import { SourceType } from '../../common/constants/types';

/**
 * 三种来源对应的模板字段（即系统内部字段）。
 * 注意：仓库类型（warehouse）在真实模板中**没有对应列**，
 * 由导入页「仓库类型」选择器提供（见 upload.service），故不在此列出。
 */
export const TEMPLATE_FIELDS: Record<SourceType, string[]> = {
  eop: ['sku_code', 'sku_name', 'barcode', 'stock_qty', 'actual_qty', 'return_qty'],
  wms: ['sku_code', 'sku_name', 'stock_qty', 'unsorted_qty', 'expiration_date'],
  gift: ['sku_code', 'sku_name', 'effective_date'],
  unsorted: ['sku_code', 'sku_name', 'unsorted_qty'],
};

/** 必填字段（仓库类型不在此，因为来自选择器而非列）。 */
export const REQUIRED_FIELDS: Record<SourceType, string[]> = {
  eop: ['sku_code', 'stock_qty', 'actual_qty'],
  wms: ['sku_code'],
  gift: ['sku_code'],
  unsorted: ['sku_code', 'unsorted_qty'],
};

/** 字段 → 表头关键词（用于推断映射）。 */
const FIELD_KEYWORDS: Record<string, string[]> = {
  // 注意 sku_name 不能含 '商品'：WMS 模板 companyCode 排在 itemCode 前，会误匹配
  // sku_name 也不能含太泛的 '商品'：会与 sku_code 的 '商品编码' 冲突，导致 sku_name 误匹配
  sku_code: ['sku', '编码', '货号', '物料', 'item', '货品'],
  sku_name: ['名称', '品名', 'name', '中文名', '货品'],
  warehouse: ['仓库', '仓类型', '类型', 'warehouse'],
  stock_qty: ['总库存', '库存', 'stock', '数量', 'onhand', 'hand'],
  actual_qty: ['实际', '在库', 'actual'],
  return_qty: ['退货', '在途', 'return'],
  available_qty: ['可用', 'available'],
  unsorted_qty: ['未分拣', '待分拣', 'unsorted'],
  effective_date: ['效期', '生效', '日期', 'date', '有效期'],
  expiration_date: ['效期', 'expiration', '有效期'],
  barcode: ['条码', 'barcode'],
};

/**
 * WMS 未分拣模板（出库单行）识别关键词。
 * 真实模板表头含「出库单号 / 波次号」，与库存快照（onHandQty）结构不同。
 */
const UNSORTED_TEMPLATE_KEYWORDS = ['出库单号', '波次号', '快递单号'];

@Injectable()
export class FieldMappingService {
  /** 该 WMS 模板是否为「未分拣出库单行」结构。 */
  isUnsortedTemplate(headers: string[]): boolean {
    const lower = headers.map((h) => h.toLowerCase());
    return UNSORTED_TEMPLATE_KEYWORDS.some((kw) =>
      lower.some((h) => h.includes(kw.toLowerCase())),
    );
  }

  /** 根据表头关键词推断 模板字段 → 源表头 的映射。 */
  suggestMapping(headers: string[], source: SourceType): Record<string, string> {
    // 未分拣报表（source=unsorted）：用户已明确指定来源，无需再依赖表头关键词确认，
    // 直接按未分拣出库单行模板推断（数量列可能是中文「数量」，也可能是 WMS 英文 onHandQty）。
    if (source === 'unsorted') {
      return this.suggestUnsortedMapping(headers);
    }
    // WMS 未分拣模板（中文表头含出库单号/波次号）：按未分拣模板推断
    if (source === 'wms' && this.isUnsortedTemplate(headers)) {
      return this.suggestUnsortedMapping(headers);
    }
    const mapping: Record<string, string> = {};
    const lowerHeaders = headers.map((h) => ({ raw: h, lower: h.toLowerCase() }));
    for (const field of TEMPLATE_FIELDS[source]) {
      const keywords = FIELD_KEYWORDS[field] || [];
      const hit = lowerHeaders.find((h) =>
        keywords.some((kw) => h.lower.includes(kw.toLowerCase())),
      );
      if (hit) {
        mapping[field] = hit.raw;
      }
    }
    return mapping;
  }

  /**
   * 未分拣出库单行模板的映射：
   * sku_code ← 货品编码 / sku_name ← 货品名称 / unsorted_qty ← 数量（或 onHandQty）。
   * 「数量」过于通用，仅在明确为未分拣模板（source=unsorted 或中文未分拣表头）时才用于 unsorted_qty。
   */
  private suggestUnsortedMapping(headers: string[]): Record<string, string> {
    const lowerHeaders = headers.map((h) => ({ raw: h, lower: h.toLowerCase() }));
    const find = (kws: string[]): string | undefined =>
      lowerHeaders.find((h) => kws.some((kw) => h.lower.includes(kw.toLowerCase())))?.raw;

    const mapping: Record<string, string> = {};
    const sku = find(['货品编码', '商品编码', 'itemcode', 'sku']);
    const name = find(['货品名称', '商品名称', 'name']);
    const qty = find(['数量', 'qty', 'unsorted', 'onhand', 'hand']);
    if (sku) mapping.sku_code = sku;
    if (name) mapping.sku_name = name;
    if (qty) mapping.unsorted_qty = qty;
    return mapping;
  }
}
