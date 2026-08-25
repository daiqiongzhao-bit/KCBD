export * from './api';

export type WarehouseType = 'normal' | 'expired';
export type SourceType = 'eop' | 'wms' | 'gift' | 'unsorted';
export type ReconcileStatus = 'match' | 'diff';
export type DiffType = 'more' | 'less' | 'none';
export type DiffCause =
  | 'missing_inbound'
  | 'missing_outbound'
  | 'time_gap'
  | 'other'
  | 'unset';
export type Role = 'admin' | 'warehouse' | 'finance' | 'manager';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  status: 'active' | 'frozen';
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface Product {
  id: number;
  sku_code: string;
  sku_name: string;
  barcode?: string | null;
  is_gift: boolean;
  created_at: string;
}

export interface EopInventory {
  id: number;
  batch_id: number;
  row_no: number | null;
  sku_code: string;
  warehouse: WarehouseType;
  barcode: string | null;
  sku_name: string | null;
  sku_name_full: string | null;
  english_name: string | null;
  spec: string | null;
  spec_full: string | null;
  category_new: string | null;
  brand: string | null;
  stock_qty: number;
  return_qty: number;
  actual_qty: number;
  store: string | null;
  sub_store: string | null;
  counter: string | null;
  big_class: string | null;
  supplier: string | null;
  business_mode: string | null;
  prod_no: string | null;
  prod_no_full: string | null;
  category: string | null;
  is_sample: string | null;
  avg_price_tax_in: number | null;
  avg_price_tax_out: number | null;
  stock_amt_tax_in: number | null;
  stock_amt_tax_out: number | null;
  sale_price: number | null;
  sale_amt: number | null;
  season: string | null;
  color: string | null;
  size: string | null;
  style: string | null;
  season_inner: string | null;
  skc_boutique: string | null;
  spu_boutique: string | null;
  snapshot_at: string;
}

export interface WmsInventory {
  id: number;
  batch_id: number;
  row_no: number | null;
  sku_code: string;
  warehouse: WarehouseType;
  company_code: string | null;
  sku_name: string | null;
  location_code: string | null;
  zone_code: string | null;
  stock_qty: number;
  in_transit_qty: number;
  allocated_qty: number;
  locked_qty: number;
  frozen_qty: number;
  available_qty: number;
  unsorted_qty: number;
  lot: string | null;
  manufacture_date: string | null;
  expiration_date: string | null;
  aging_date: string | null;
  attribute1: string | null;
  inventory_sts: string | null;
  lpn: string | null;
  shelf_life_sts: string | null;
  snapshot_at: string;
}

/** 未分拣出库单行（来自「正常/临期仓未分拣」报表导入）。 */
export interface UnsortedOrderRow {
  id: number;
  batch_id: number;
  warehouse: WarehouseType;
  order_no: string | null;
  order_type: string | null;
  carrier_code: string | null;
  express_no: string | null;
  wave_no: string | null;
  sku_code: string;
  sku_name: string | null;
  qty: number;
  recipient: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  id_card: string | null;
  fail_reason: string | null;
  created_at: string | null;
}

export interface InventoryReconcile {
  id: number;
  eop_batch_id: number;
  wms_batch_id: number;
  sku_code: string;
  sku_name: string;
  warehouse: WarehouseType;
  is_gift: boolean;
  eop_stock: number;
  eop_actual: number;
  eop_return: number;
  wms_total: number;
  wms_available: number;
  wms_unsorted: number;
  diff_value: number;
  diff_value_actual: number;
  diff_rate: number;
  diff_type: DiffType;
  possible_cause: string;
  status: ReconcileStatus;
  cleared?: boolean;
  reconciled_at: string;
  handleStatus?: string;
  handleCause?: DiffCause;
  latestNote?: string | null;
}

export interface UploadBatch {
  id: number;
  source: SourceType;
  file_name: string;
  content_hash: string;
  uploader_id: number;
  batch_name: string;
  row_count: number;
  rows_valid: number;
  rows_invalid: number;
  status: string;
  error_summary: { issues: Issue[] } | null;
  imported_at: string;
}

export interface Issue {
  row: number;
  field: string;
  reason: string;
}

export interface DashboardSummary {
  totalSku: number;
  eopStock: number;
  wmsStock: number;
  diffSku: number;
  giftSku: number;
  productSku: number;
  unsortedQty: number;
  expiryAlert: number;
  diffRate: number;
}

export interface TrendPoint {
  date: string;
  diffRate: number;
  diffSku: number;
  total: number;
}

export interface FormulaData {
  eopActual: number;
  wmsAvailable: number;
  eopStock: number;
  wmsTotal: number;
}

export interface Notification {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  message: string;
  related_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface DiffHandling {
  id: number;
  reconcile_id: number;
  status: string;
  cause: DiffCause;
  note: string;
  operator_id: number | null;
  created_at: string;
}

export interface GiftSku {
  id: number;
  sku_code: string;
  effective_date: string | null;
  product_id?: number | null;
  product?: { sku_code: string; sku_name: string; barcode?: string | null } | null;
  created_at: string;
}

export interface AlertSettings {
  unsortedOverdueDays: number;
  expiryWarnDays: number;
  expiryUrgentDays: number;
}

export interface OperationLog {
  id: number;
  user_id: number | null;
  operator_name?: string | null;
  action: string;
  target: string | null;
  detail: unknown;
  created_at: string;
}

export interface UnsortedItem {
  sku_code: string;
  barcode: string;
  warehouse: WarehouseType;
  unsorted_qty: number;
  available_qty: number;
  stock_qty: number;
  snapshot_at: string;
  overdueDays: number;
  level: string;
}

/** 未分拣出库单行透视汇总（按 SKU）。 */
export interface UnsortedPivotItem {
  sku_code: string;
  barcode: string;
  sku_name: string;
  order_count: number;
  total_qty: number;
  warehouse: WarehouseType;
}

export interface ReturnsItem {
  warehouse: WarehouseType;
  skuCount: number;
  eopReturn: number | null;
  wmsEquivalent: number;
  gap: number | null;
}

export interface ExpiryBucket {
  daysToExpire: number;
  label: string;
  count: number;
}

export interface ExpiryAlert {
  sku_code: string;
  warehouse: WarehouseType;
  expiration_date: string;
  available_qty: number;
  row_no: number | null;
  barcode: string;
  sku_name: string;
  daysToExpire: number;
  level: string;
}

export interface RunSummary {
  total: number;
  match: number;
  diff: number;
  more: number;
  less: number;
}

export interface RoleDefinition {
  role: Role;
  name: string;
  description: string;
  permissions: string[];
}

export interface PermissionPoint {
  permission: string;
  name: string;
  group: string;
}

export interface RolePermissionMap {
  role: string;
  permissions: string[];
}

export interface PreviewResult {
  headers: string[];
  suggestedMapping: Record<string, string>;
  previewRows: Record<string, string>[];
  issues: Issue[];
}
