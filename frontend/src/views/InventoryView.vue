<template>
  <div class="page-container">
    <PageToolbar title="库存" subtitle="用户上传的库存数据快照（EOP / WMS），可编辑/删除/批量删除；可点击右上角「数据导入」上传新文件">
      <template #actions>
        <el-button type="primary" @click="goImport">
          <el-icon><Upload /></el-icon> 数据导入
        </el-button>
      </template>
    </PageToolbar>
    <el-card shadow="never" class="panel-card">
      <el-tabs v-model="tab">
        <el-tab-pane label="EOP 库存" name="eop">
          <div class="batch-bar">
            <el-button type="danger" :disabled="!eopSelected.length" @click="batchRemove('eop')">
              批量删除{{ eopSelected.length ? `（已选 ${eopSelected.length} 行）` : '' }}
            </el-button>
          </div>
          <el-form inline class="filter-bar">
            <el-form-item label="类型">
              <el-radio-group v-model="eopQuery.isGift" size="small" @change="loadEop">
                <el-radio-button value="">全部</el-radio-button>
                <el-radio-button value="false">正品</el-radio-button>
                <el-radio-button value="true">赠品</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="仓库">
              <el-select v-model="eopQuery.warehouse" clearable placeholder="全部" style="width: 130px">
                <el-option label="正常仓" value="normal" />
                <el-option label="临期仓" value="expired" />
              </el-select>
            </el-form-item>
            <el-form-item label="SKU/编码">
              <el-input v-model="eopQuery.sku" placeholder="商品编码" clearable style="width: 200px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="商品条码">
              <el-input v-model="eopQuery.barcode" placeholder="商品条码" clearable style="width: 180px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="商品名称">
              <el-input v-model="eopQuery.skuName" placeholder="商品名称" clearable style="width: 180px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="商品新分类">
              <el-input v-model="eopQuery.categoryNew" placeholder="商品新分类" clearable style="width: 140px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="品牌">
              <el-input v-model="eopQuery.brand" placeholder="品牌" clearable style="width: 120px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="门店">
              <el-input v-model="eopQuery.store" placeholder="门店" clearable style="width: 140px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="店面">
              <el-input v-model="eopQuery.subStore" placeholder="店面" clearable style="width: 140px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item label="柜组">
              <el-input v-model="eopQuery.counter" placeholder="柜组" clearable style="width: 140px" @keyup.enter="loadEop" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadEop">查询</el-button>
              <el-button :loading="exportingEop" @click="onExportEop">导出</el-button>
            </el-form-item>
          </el-form>
          <div class="table-scroll">
            <el-table
              ref="eopTableRef"
              :data="eopList"
              v-loading="loading"
              border
              show-summary
              :summary-method="eopSummary"
              stripe
              @selection-change="(rows: EopInventory[]) => (eopSelected = rows)"
            >
              <el-table-column type="selection" width="48" />
              <el-table-column label="序号" width="70" align="center">
                <template #default="{ $index }">{{ (eopQuery.page - 1) * eopQuery.size + $index + 1 }}</template>
              </el-table-column>
              <el-table-column label="仓库" width="90">
                <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
              </el-table-column>
              <el-table-column prop="sku_code" label="商品编码" width="140" />
              <el-table-column prop="barcode" label="商品条码" width="150" />
              <el-table-column prop="sku_name" label="中文名称" min-width="200" show-overflow-tooltip />
              <el-table-column prop="sku_name_full" label="中文名称-全称" min-width="200" show-overflow-tooltip />
              <el-table-column prop="english_name" label="英文名称" min-width="160" show-overflow-tooltip />
              <el-table-column prop="spec" label="商品规格" width="120" show-overflow-tooltip />
              <el-table-column prop="spec_full" label="规格-全称" width="120" show-overflow-tooltip />
              <el-table-column prop="category_new" label="商品新分类" min-width="140" show-overflow-tooltip />
              <el-table-column prop="brand" label="品牌" width="120" show-overflow-tooltip />
              <el-table-column prop="stock_qty" label="库存数量" width="100" align="right" />
              <el-table-column prop="return_qty" label="退货数量" width="100" align="right" />
              <el-table-column prop="actual_qty" label="实际库存数量" width="110" align="right" />
              <el-table-column prop="store" label="门店" width="140" show-overflow-tooltip />
              <el-table-column prop="sub_store" label="店面" width="140" show-overflow-tooltip />
              <el-table-column prop="counter" label="柜组" width="140" show-overflow-tooltip />
              <el-table-column prop="big_class" label="大类" width="90" />
              <el-table-column prop="supplier" label="供应商" min-width="140" show-overflow-tooltip />
              <el-table-column prop="business_mode" label="经营方式" width="100" />
              <el-table-column prop="prod_no" label="厂商货号" width="140" show-overflow-tooltip />
              <el-table-column prop="prod_no_full" label="厂商货号-全称" width="140" show-overflow-tooltip />
              <el-table-column prop="category" label="类别" width="120" show-overflow-tooltip />
              <el-table-column prop="is_sample" label="是否样品" width="90" />
              <el-table-column prop="avg_price_tax_in" label="平均含税进价" width="120" align="right" />
              <el-table-column prop="avg_price_tax_out" label="平均不含税进价" width="120" align="right" />
              <el-table-column prop="stock_amt_tax_in" label="库存含税进价金额" width="150" align="right" />
              <el-table-column prop="stock_amt_tax_out" label="库存不含税进价金额" width="150" align="right" />
              <el-table-column prop="sale_price" label="售价" width="100" align="right" />
              <el-table-column prop="sale_amt" label="售价金额" width="100" align="right" />
              <el-table-column prop="season" label="适用季节" width="100" />
              <el-table-column prop="color" label="花色" width="100" />
              <el-table-column prop="size" label="尺码" width="90" />
              <el-table-column prop="style" label="款式" width="120" show-overflow-tooltip />
              <el-table-column prop="season_inner" label="内部季节" width="100" />
              <el-table-column prop="skc_boutique" label="SKC精品" width="100" />
              <el-table-column prop="spu_boutique" label="SPU精品" width="100" />
              <el-table-column label="操作" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button text type="primary" @click="openEdit('eop', row)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <PageBar
            :total="eopTotal"
            :selected="eopSelected.length"
            :current-page="eopQuery.page"
            :page-size="eopQuery.size"
            @change="(p: number) => { eopQuery.page = p; loadEop(); }"
            @size-change="(s: number) => { eopQuery.size = s; loadEop(); }"
          />
        </el-tab-pane>

        <el-tab-pane label="WMS 库存" name="wms">
          <div class="batch-bar">
            <el-button type="danger" :disabled="!wmsSelected.length" @click="batchRemove('wms')">
              批量删除{{ wmsSelected.length ? `（已选 ${wmsSelected.length} 行）` : '' }}
            </el-button>
          </div>
          <el-form inline class="filter-bar">
            <el-form-item label="类型">
              <el-radio-group v-model="wmsQuery.isGift" size="small" @change="loadWms">
                <el-radio-button value="">全部</el-radio-button>
                <el-radio-button value="false">正品</el-radio-button>
                <el-radio-button value="true">赠品</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="仓库">
              <el-select v-model="wmsQuery.warehouse" clearable placeholder="全部" style="width: 130px">
                <el-option label="正常仓" value="normal" />
                <el-option label="临期仓" value="expired" />
              </el-select>
            </el-form-item>
            <el-form-item label="SKU/编码">
              <el-input v-model="wmsQuery.sku" placeholder="商品编码" clearable style="width: 200px" @keyup.enter="loadWms" />
            </el-form-item>
            <el-form-item label="商品条码">
              <el-input v-model="wmsQuery.barcode" placeholder="商品条码" clearable style="width: 180px" @keyup.enter="loadWms" />
            </el-form-item>
            <el-form-item label="商品名称">
              <el-input v-model="wmsQuery.skuName" placeholder="商品名称" clearable style="width: 180px" @keyup.enter="loadWms" />
            </el-form-item>
            <el-form-item label="库位">
              <el-input v-model="wmsQuery.locationCode" placeholder="库位" clearable style="width: 140px" @keyup.enter="loadWms" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadWms">查询</el-button>
              <el-button :loading="exportingWms" @click="onExportWms">导出</el-button>
            </el-form-item>
          </el-form>
          <div class="table-scroll">
            <el-table
              ref="wmsTableRef"
              :data="wmsList"
              v-loading="loading"
              border
              show-summary
              :summary-method="wmsSummary"
              stripe
              @selection-change="(rows: WmsInventory[]) => (wmsSelected = rows)"
            >
              <el-table-column type="selection" width="48" />
              <el-table-column label="序号" width="70" align="center">
                <template #default="{ $index }">{{ (wmsQuery.page - 1) * wmsQuery.size + $index + 1 }}</template>
              </el-table-column>
              <el-table-column label="仓库" width="90">
                <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
              </el-table-column>
              <el-table-column prop="company_code" label="companyCode" width="120" />
              <el-table-column prop="sku_code" label="itemCode" width="140" />
              <el-table-column prop="sku_name" label="商品名称" min-width="200" show-overflow-tooltip />
              <el-table-column prop="location_code" label="库位" width="140" show-overflow-tooltip />
              <el-table-column prop="zone_code" label="库区" width="90" />
              <el-table-column prop="stock_qty" label="onHandQty 库存数量" width="140" align="right" />
              <el-table-column prop="in_transit_qty" label="inTransitQty 在途" width="130" align="right" />
              <el-table-column prop="allocated_qty" label="allocatedQty 已分配" width="130" align="right" />
              <el-table-column prop="locked_qty" label="lockedQty 锁定" width="120" align="right" />
              <el-table-column prop="frozen_qty" label="frozenQty 冻结" width="120" align="right" />
              <el-table-column prop="available_qty" label="availableQty 可用" width="130" align="right" />
              <el-table-column prop="unsorted_qty" label="未分拣" width="100" align="right" />
              <el-table-column prop="lot" label="批次" width="120" />
              <el-table-column prop="manufacture_date" label="生产日期" width="110" />
              <el-table-column prop="expiration_date" label="expirationDate 效期" width="140" />
              <el-table-column prop="aging_date" label="agingDate 库龄" width="130" />
              <el-table-column prop="attribute1" label="attribute1" width="100" />
              <el-table-column prop="inventory_sts" label="inventorySts" width="100" />
              <el-table-column prop="lpn" label="lpn" width="100" />
              <el-table-column prop="shelf_life_sts" label="shelfLifeSts" width="100" />
              <el-table-column label="操作" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button text type="primary" @click="openEdit('wms', row)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <PageBar
            :total="wmsTotal"
            :selected="wmsSelected.length"
            :current-page="wmsQuery.page"
            :page-size="wmsQuery.size"
            @change="(p: number) => { wmsQuery.page = p; loadWms(); }"
            @size-change="(s: number) => { wmsQuery.size = s; loadWms(); }"
          />
        </el-tab-pane>

        <el-tab-pane label="未分拣报表" name="unsorted">
          <el-form inline class="filter-bar">
            <el-form-item label="类型">
              <el-radio-group v-model="unsortedQuery.isGift" size="small" @change="loadUnsorted">
                <el-radio-button value="">全部</el-radio-button>
                <el-radio-button value="false">正品</el-radio-button>
                <el-radio-button value="true">赠品</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="仓库">
              <el-select v-model="unsortedQuery.warehouse" clearable placeholder="全部" style="width: 130px">
                <el-option label="正常仓" value="normal" />
                <el-option label="临期仓" value="expired" />
              </el-select>
            </el-form-item>
            <el-form-item label="商品编码">
              <el-input v-model="unsortedQuery.sku" placeholder="商品编码" clearable style="width: 140px" @keyup.enter="loadUnsorted" />
            </el-form-item>
            <el-form-item label="商品条码">
              <el-input v-model="unsortedQuery.barcode" placeholder="商品条码" clearable style="width: 160px" @keyup.enter="loadUnsorted" />
            </el-form-item>
            <el-form-item label="商品名称">
              <el-input v-model="unsortedQuery.skuName" placeholder="商品名称" clearable style="width: 180px" @keyup.enter="loadUnsorted" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadUnsorted">查询</el-button>
              <el-button :loading="exportingUnsorted" @click="onExportUnsorted">导出</el-button>
            </el-form-item>
          </el-form>
          <div class="table-scroll">
            <el-table
              :data="unsortedList"
              v-loading="unsortedLoading"
              border
              stripe
              max-height="600"
            >
              <el-table-column label="序号" width="64" align="center">
                <template #default="{ $index }">{{ (unsortedQuery.page - 1) * unsortedQuery.size + $index + 1 }}</template>
              </el-table-column>
              <el-table-column label="仓库" width="90">
                <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
              </el-table-column>
              <el-table-column prop="order_no" label="出库单号" width="160" show-overflow-tooltip />
              <el-table-column prop="sku_code" label="商品编码" width="140" />
              <el-table-column prop="sku_name" label="商品名称" min-width="180" show-overflow-tooltip />
              <el-table-column prop="qty" label="数量" width="100" align="right" />
              <el-table-column prop="wave_no" label="波次号" width="120" show-overflow-tooltip />
              <el-table-column prop="express_no" label="快递单号" width="140" show-overflow-tooltip />
              <el-table-column prop="carrier_code" label="承运人" width="100" show-overflow-tooltip />
              <el-table-column prop="recipient" label="收件人" width="100" show-overflow-tooltip />
              <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip />
              <el-table-column prop="created_at" label="创建时间" width="160" show-overflow-tooltip />
            </el-table>
          </div>
          <PageBar
            :total="unsortedTotal"
            :selected="0"
            :current-page="unsortedQuery.page"
            :page-size="unsortedQuery.size"
            @change="(p: number) => { unsortedQuery.page = p; loadUnsorted(); }"
            @size-change="(s: number) => { unsortedQuery.size = s; loadUnsorted(); }"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 编辑弹窗（EOP/WMS 共用，按 source 切换字段；底部含保存/删除） -->
    <el-dialog v-model="dlg" :title="editSource === 'eop' ? '编辑 EOP 库存' : '编辑 WMS 库存'" width="460">
      <el-form :model="editForm" label-width="120px">
        <el-form-item :label="editSource === 'eop' ? '商品编码' : 'itemCode'">
          <el-input :value="editForm.sku_code" disabled />
        </el-form-item>
        <el-form-item :label="editSource === 'eop' ? '中文名称' : '商品名称'">
          <el-input :value="editForm.sku_name || '-'" disabled />
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="editForm.warehouse" style="width: 100%">
            <el-option label="正常仓" value="normal" />
            <el-option label="临期仓" value="expired" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editSource === 'eop'" label="库存数量">
          <el-input-number v-model="editForm.stock_qty" :min="0" :precision="3" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="editSource === 'eop'" label="退货数量">
          <el-input-number v-model="editForm.return_qty" :min="0" :precision="3" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="editSource === 'eop'" label="实际库存数量">
          <el-input-number v-model="editForm.actual_qty" :min="0" :precision="3" style="width: 100%" />
        </el-form-item>
        <template v-else>
          <el-form-item label="库存数量 (onHandQty)">
            <el-input-number v-model="editForm.stock_qty" :min="0" :precision="3" style="width: 100%" />
          </el-form-item>
          <el-form-item label="可用 (availableQty)">
            <el-input-number v-model="editForm.available_qty" :min="0" :precision="3" style="width: 100%" />
          </el-form-item>
          <el-form-item label="未分拣">
            <el-input-number v-model="editForm.unsorted_qty" :min="0" :precision="3" style="width: 100%" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button type="danger" :loading="removing" @click="removeFromDlg">删除</el-button>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import * as inventoryApi from '@/api/inventory';
import { normalizeSize } from '@/utils/page';
import { downloadBlob } from '@/utils/download';
import type { EopInventory, WmsInventory, UnsortedOrderRow } from '@/types';

const tab = ref<'eop' | 'wms' | 'unsorted'>('eop');
const router = useRouter();
const goImport = () => router.push('/import');
const loading = ref(false);
const saving = ref(false);
const removing = ref(false);

/** EOP 库存页底部汇总：EOP 账面/实物/退货在途/SKU 数。 */
const eopSummary = ({ columns, data }: { columns: any[]; data: EopInventory[] }) => {
  const sums: string[] = [];
  columns.forEach((col, idx) => {
    if (idx === 0) {
      sums.push('合计');
    } else if (col.property === 'stock_qty' || col.property === 'actual_qty' || col.property === 'return_qty') {
      const total = data.reduce((s, r) => s + Number((r as any)[col.property] || 0), 0);
      sums.push(total.toString());
    } else if (col.label === '序号') {
      sums.push(`${data.length} 行`);
    } else {
      sums.push('');
    }
  });
  return sums;
};

/** WMS 库存页底部汇总：WMS 总（在库）/ 可用 / 未分拣 / SKU 数。 */
const wmsSummary = ({ columns, data }: { columns: any[]; data: WmsInventory[] }) => {
  const sums: string[] = [];
  columns.forEach((col, idx) => {
    if (idx === 0) {
      sums.push('合计');
    } else if (['stock_qty', 'available_qty', 'unsorted_qty'].includes(col.property)) {
      const total = data.reduce((s, r) => s + Number((r as any)[col.property] || 0), 0);
      sums.push(total.toString());
    } else if (col.label === '序号') {
      sums.push(`${data.length} 行`);
    } else {
      sums.push('');
    }
  });
  return sums;
};

const eopQuery = ref({
  warehouse: undefined as string | undefined,
  sku: '',
  barcode: '',
  skuName: '',
  categoryNew: '',
  brand: '',
  store: '',
  subStore: '',
  counter: '',
  isGift: '',
  page: 1,
  size: 100,
});
const eopList = ref<EopInventory[]>([]);
const eopTotal = ref(0);
const eopSelected = ref<EopInventory[]>([]);

const wmsQuery = ref({
  warehouse: undefined as string | undefined,
  sku: '',
  barcode: '',
  skuName: '',
  locationCode: '',
  isGift: '',
  page: 1,
  size: 100,
});
const wmsList = ref<WmsInventory[]>([]);
const wmsTotal = ref(0);
const wmsSelected = ref<WmsInventory[]>([]);

const unsortedQuery = ref({
  warehouse: undefined as string | undefined,
  sku: '',
  barcode: '',
  skuName: '',
  isGift: '',
  page: 1,
  size: 100,
});
const unsortedList = ref<UnsortedOrderRow[]>([]);
const unsortedTotal = ref(0);
const unsortedLoading = ref(false);

const exportingEop = ref(false);
const exportingWms = ref(false);
const exportingUnsorted = ref(false);

const dlg = ref(false);
const editSource = ref<'eop' | 'wms'>('eop');
const editForm = ref<{
  id: number;
  sku_code: string;
  sku_name: string;
  warehouse: 'normal' | 'expired';
  stock_qty: number;
  actual_qty?: number;
  return_qty?: number;
  available_qty?: number;
  unsorted_qty?: number;
}>({
  id: 0,
  sku_code: '',
  sku_name: '',
  warehouse: 'normal',
  stock_qty: 0,
});

const loadEop = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.listEopInventory({
      warehouse: eopQuery.value.warehouse || undefined,
      sku: eopQuery.value.sku || undefined,
      barcode: eopQuery.value.barcode || undefined,
      skuName: eopQuery.value.skuName || undefined,
      categoryNew: eopQuery.value.categoryNew || undefined,
      brand: eopQuery.value.brand || undefined,
      store: eopQuery.value.store || undefined,
      subStore: eopQuery.value.subStore || undefined,
      counter: eopQuery.value.counter || undefined,
      isGift: eopQuery.value.isGift || undefined,
      page: eopQuery.value.page,
      size: normalizeSize(eopQuery.value.size),
    });
    eopList.value = res.items;
    eopTotal.value = res.total;
    eopSelected.value = [];
  } finally {
    loading.value = false;
  }
};

const loadWms = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.listWmsInventory({
      warehouse: wmsQuery.value.warehouse || undefined,
      sku: wmsQuery.value.sku || undefined,
      barcode: wmsQuery.value.barcode || undefined,
      skuName: wmsQuery.value.skuName || undefined,
      locationCode: wmsQuery.value.locationCode || undefined,
      isGift: wmsQuery.value.isGift || undefined,
      page: wmsQuery.value.page,
      size: normalizeSize(wmsQuery.value.size),
    });
    wmsList.value = res.items;
    wmsTotal.value = res.total;
    wmsSelected.value = [];
  } finally {
    loading.value = false;
  }
};

const loadUnsorted = async () => {
  unsortedLoading.value = true;
  try {
    const res = await inventoryApi.listUnsortedOrders({
      warehouse: unsortedQuery.value.warehouse || undefined,
      sku: unsortedQuery.value.sku || undefined,
      barcode: unsortedQuery.value.barcode || undefined,
      skuName: unsortedQuery.value.skuName || undefined,
      isGift: unsortedQuery.value.isGift || undefined,
      page: unsortedQuery.value.page,
      size: normalizeSize(unsortedQuery.value.size),
    });
    unsortedList.value = res.items;
    unsortedTotal.value = res.total;
  } finally {
    unsortedLoading.value = false;
  }
};

const buildEopParams = () => ({
  warehouse: eopQuery.value.warehouse || undefined,
  sku: eopQuery.value.sku || undefined,
  barcode: eopQuery.value.barcode || undefined,
  skuName: eopQuery.value.skuName || undefined,
  categoryNew: eopQuery.value.categoryNew || undefined,
  brand: eopQuery.value.brand || undefined,
  store: eopQuery.value.store || undefined,
  subStore: eopQuery.value.subStore || undefined,
  counter: eopQuery.value.counter || undefined,
  isGift: eopQuery.value.isGift || undefined,
});

const buildWmsParams = () => ({
  warehouse: wmsQuery.value.warehouse || undefined,
  sku: wmsQuery.value.sku || undefined,
  barcode: wmsQuery.value.barcode || undefined,
  skuName: wmsQuery.value.skuName || undefined,
  locationCode: wmsQuery.value.locationCode || undefined,
  isGift: wmsQuery.value.isGift || undefined,
});

const buildUnsortedParams = () => ({
  warehouse: unsortedQuery.value.warehouse || undefined,
  sku: unsortedQuery.value.sku || undefined,
  barcode: unsortedQuery.value.barcode || undefined,
  skuName: unsortedQuery.value.skuName || undefined,
  isGift: unsortedQuery.value.isGift || undefined,
});

const onExportEop = async () => {
  exportingEop.value = true;
  try {
    const blob = await inventoryApi.exportEopInventory(buildEopParams());
    downloadBlob(blob, `eop-inventory-${Date.now()}.xlsx`);
  } finally {
    exportingEop.value = false;
  }
};

const onExportWms = async () => {
  exportingWms.value = true;
  try {
    const blob = await inventoryApi.exportWmsInventory(buildWmsParams());
    downloadBlob(blob, `wms-inventory-${Date.now()}.xlsx`);
  } finally {
    exportingWms.value = false;
  }
};

const onExportUnsorted = async () => {
  exportingUnsorted.value = true;
  try {
    const blob = await inventoryApi.exportUnsortedOrders(buildUnsortedParams());
    downloadBlob(blob, `unsorted-orders-${Date.now()}.xlsx`);
  } finally {
    exportingUnsorted.value = false;
  }
};

const openEdit = (source: 'eop' | 'wms', row: any) => {
  editSource.value = source;
  editForm.value = {
    id: row.id,
    sku_code: row.sku_code,
    sku_name: row.sku_name || '',
    warehouse: row.warehouse,
    stock_qty: row.stock_qty,
    actual_qty: (row as EopInventory).actual_qty,
    return_qty: (row as EopInventory).return_qty,
    available_qty: (row as WmsInventory).available_qty,
    unsorted_qty: (row as WmsInventory).unsorted_qty,
  };
  dlg.value = true;
};

const saveEdit = async () => {
  saving.value = true;
  try {
    if (editSource.value === 'eop') {
      await inventoryApi.updateEopInventory(editForm.value.id, {
        stock_qty: editForm.value.stock_qty,
        actual_qty: editForm.value.actual_qty,
        return_qty: editForm.value.return_qty,
        warehouse: editForm.value.warehouse,
      });
    } else {
      await inventoryApi.updateWmsInventory(editForm.value.id, {
        stock_qty: editForm.value.stock_qty,
        available_qty: editForm.value.available_qty,
        unsorted_qty: editForm.value.unsorted_qty,
        warehouse: editForm.value.warehouse,
      });
    }
    ElMessage.success('已保存');
    dlg.value = false;
    if (editSource.value === 'eop') loadEop();
    else loadWms();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

/** 弹窗内删除：二次确认 → 调 DELETE → 关闭弹窗 → 刷新 */
const removeFromDlg = async () => {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${editSource.value.toUpperCase()} 库存行 ${editForm.value.sku_code}？被对账引用的行不能删除`,
      '删除确认',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  removing.value = true;
  try {
    if (editSource.value === 'eop') {
      await inventoryApi.removeEopInventory(editForm.value.id);
    } else {
      await inventoryApi.removeWmsInventory(editForm.value.id);
    }
    ElMessage.success('已删除');
    dlg.value = false;
    if (editSource.value === 'eop') loadEop();
    else loadWms();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '删除失败');
  } finally {
    removing.value = false;
  }
};

/** 批量删除：逐行调用，被对账引用的行跳过，结果汇总提示 */
const batchRemove = async (source: 'eop' | 'wms') => {
  const rows = source === 'eop' ? eopSelected.value : wmsSelected.value;
  if (!rows.length) return;
  try {
    await ElMessageBox.confirm(
      `确认批量删除 ${source.toUpperCase()} 库存共 ${rows.length} 行？被对账引用的行将被跳过`,
      '批量删除确认',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  let success = 0;
  let skipped = 0;
  const skippedCodes: string[] = [];
  for (const r of rows) {
    try {
      if (source === 'eop') {
        await inventoryApi.removeEopInventory(r.id);
      } else {
        await inventoryApi.removeWmsInventory(r.id);
      }
      success++;
    } catch (e: any) {
      skipped++;
      skippedCodes.push(r.sku_code);
    }
  }
  if (source === 'eop') {
    eopSelected.value = [];
  } else {
    wmsSelected.value = [];
  }
  if (source === 'eop') loadEop();
  else loadWms();
  if (success && !skipped) {
    ElMessage.success(`已删除 ${success} 行`);
  } else if (success && skipped) {
    ElMessage.warning(`已删除 ${success} 行，跳过 ${skipped} 行（被对账引用）：${skippedCodes.join(', ')}`);
  } else {
    ElMessage.error(`全部 ${skipped} 行删除失败：${skippedCodes.join(', ')}`);
  }
};

onMounted(() => {
  loadEop();
  loadWms();
  loadUnsorted();
});
watch(tab, (v) => {
  if (v === 'unsorted') loadUnsorted();
});
</script>

<style scoped>
.panel-card {
  border-radius: 12px;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  min-height: 32px;
}
.filter-bar {
  margin-bottom: 4px;
}
.table-scroll {
  overflow-x: auto;
  width: 100%;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
</style>