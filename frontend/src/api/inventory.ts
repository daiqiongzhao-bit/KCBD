import { get, put, del, post } from './http';
import type {
  PageResult,
  Product,
  EopInventory,
  WmsInventory,
  UnsortedOrderRow,
} from '@/types';

/** 商品主数据分页查询（R-P0-14）。 */
export const listProducts = (
  params?: Record<string, unknown>,
): Promise<PageResult<Product>> => get('/products', { params });

/** 新增商品主档。 */
export const createProduct = (data: {
  sku_code: string;
  sku_name?: string;
  barcode?: string;
  is_gift?: boolean;
}): Promise<{ id: number }> => post('/products', data);

/** 修改商品主档。 */
export const updateProduct = (
  id: number,
  data: { sku_name?: string; barcode?: string; is_gift?: boolean },
): Promise<{ id: number }> => put(`/products/${id}`, data);

/** 删除商品主档（被赠品关联时服务端拒绝）。 */
export const deleteProduct = (id: number): Promise<{ id: number }> =>
  del(`/products/${id}`);

/** 导入商品主档（xlsx：商品编码/中文名称/商品条码）。 */
export const importProducts = (file: File): Promise<{ total: number; imported: number; skipped: number }> => {
  const fd = new FormData();
  fd.append('file', file);
  return post('/products/import', fd);
};

/** EOP 库存快照分页查询（库存模块）。 */
export const listEopInventory = (
  params?: Record<string, unknown>,
): Promise<PageResult<EopInventory>> => get('/eop-inventory', { params });

/** 导出 EOP 库存（按当前查询条件）。 */
export const exportEopInventory = (params?: Record<string, unknown>): Promise<Blob> =>
  get('/eop-inventory/export', { params, responseType: 'blob' }) as unknown as Promise<Blob>;

/** WMS 库存快照分页查询（库存模块）。 */
export const listWmsInventory = (
  params?: Record<string, unknown>,
): Promise<PageResult<WmsInventory>> => get('/wms-inventory', { params });

/** 导出 WMS 库存（按当前查询条件）。 */
export const exportWmsInventory = (params?: Record<string, unknown>): Promise<Blob> =>
  get('/wms-inventory/export', { params, responseType: 'blob' }) as unknown as Promise<Blob>;

/** 未分拣出库单行明细（最新一批，区分正常/临期仓；batchId 可回溯旧批次）。 */
export const listUnsortedOrders = (
  params?: Record<string, unknown>,
): Promise<PageResult<UnsortedOrderRow>> => get('/unsorted-orders', { params });

/** 导出未分拣报表（按当前查询条件）。 */
export const exportUnsortedOrders = (params?: Record<string, unknown>): Promise<Blob> =>
  get('/unsorted-orders/export', { params, responseType: 'blob' }) as unknown as Promise<Blob>;

/** 含未分拣出库单行的批次列表（批次下拉回溯用）。 */
export const listUnsortedBatches = (): Promise<
  { id: number; imported_at: string | null; order_count: number }[]
> => get('/unsorted-batches');

/** EOP 库存行编辑（仅核心数值/仓库可改）。 */
export const updateEopInventory = (
  id: number,
  body: {
    stock_qty?: number;
    actual_qty?: number;
    return_qty?: number;
    warehouse?: 'normal' | 'expired';
  },
): Promise<{ id: number }> => put(`/eop-inventory/${id}`, body);

/** 删除 EOP 库存行（被对账引用则被服务端拒绝）。 */
export const removeEopInventory = (id: number): Promise<{ id: number }> =>
  del(`/eop-inventory/${id}`);

/** WMS 库存行编辑（仅核心数值/仓库可改）。 */
export const updateWmsInventory = (
  id: number,
  body: {
    stock_qty?: number;
    available_qty?: number;
    unsorted_qty?: number;
    warehouse?: 'normal' | 'expired';
  },
): Promise<{ id: number }> => put(`/wms-inventory/${id}`, body);

/** 删除 WMS 库存行（被对账引用则被服务端拒绝）。 */
export const removeWmsInventory = (id: number): Promise<{ id: number }> =>
  del(`/wms-inventory/${id}`);
