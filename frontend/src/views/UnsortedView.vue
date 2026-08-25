<template>
  <div class="page-container">
    <PageToolbar title="未分拣报表" subtitle="出库单行按 SKU 透视汇总">
      <template #actions>
        <el-button :loading="pivotLoading" @click="loadAll">刷新</el-button>
      </template>
    </PageToolbar>

    <div class="panel">
      <div class="panel-title">
        <span>
          按 SKU 透视汇总
          <span class="pv-sub">（不同订单购买同一商品合并展示）</span>
        </span>
        <span class="pv-total">
          总数量合计：<b>{{ pivotTotalQty.toLocaleString() }}</b>
        </span>
      </div>
      <el-table
        :data="pivotItems"
        v-loading="pivotLoading"
        size="small"
        border
        max-height="560"
        show-summary
        :summary-method="getSummary"
        @selection-change="(rows: UnsortedPivotItem[]) => (pivotSelected = rows)"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">{{ (pivotPage - 1) * pivotSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="warehouse" label="仓库" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.warehouse === 'expired' ? 'warning' : 'success'">
              {{ row.warehouse === 'expired' ? '临期仓' : '正常仓' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sku_code" label="商品编码" width="150" />
        <el-table-column prop="barcode" label="商品条码" width="150" />
        <el-table-column prop="sku_name" label="商品名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="order_count" label="出库单数" width="100" align="right" />
        <el-table-column prop="total_qty" label="总数量" width="100" align="right" />
      </el-table>
      <PageBar
        :total="pivotTotal"
        :selected="0"
        :current-page="pivotPage"
        :page-size="pivotSize"
        @change="onPivotPage"
        @size-change="onPivotSize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import * as dashApi from '@/api/dashboard';
import { useUiStore } from '@/stores/ui';
import { normalizeSize } from '@/utils/page';
import type { UnsortedPivotItem } from '@/types';

const ui = useUiStore();

const pivotItems = ref<UnsortedPivotItem[]>([]);
const pivotSelected = ref<UnsortedPivotItem[]>([]);
const pivotLoading = ref(false);
const pivotTotal = ref(0);
const pivotTotalQty = ref(0);
const pivotPage = ref(1);
const pivotSize = ref(25);

const loadPivot = async () => {
  pivotLoading.value = true;
  try {
    const res = await dashApi.listUnsortedPivot({
      warehouse: ui.warehouse,
      page: pivotPage.value,
      size: normalizeSize(pivotSize.value),
    });
    pivotItems.value = res.items;
    pivotTotal.value = res.total;
    pivotTotalQty.value = res.totalQty || 0;
    pivotSelected.value = [];
  } finally {
    pivotLoading.value = false;
  }
};

/** 底部合计行：总数量为全量数量合计（按 qty 列 SUM，非行数）。 */
const getSummary = ({ columns }: { columns: { property?: string }[] }): string[] => {
  const arr = columns.map(() => '');
  const idx = columns.findIndex((c) => c.property === 'total_qty');
  if (idx >= 0) arr[idx] = pivotTotalQty.value.toLocaleString();
  return arr;
};

const loadAll = () => {
  loadPivot();
};

const onPivotPage = (p: number) => {
  pivotPage.value = p;
  loadPivot();
};
const onPivotSize = (s: number) => {
  pivotSize.value = s;
  pivotPage.value = 1;
  loadPivot();
};

onMounted(loadAll);
watch(() => ui.warehouse, loadAll);
</script>

<style scoped>
.panel {
  margin-bottom: 16px;
}
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pv-sub {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  margin-left: 6px;
}
.pv-total {
  font-size: 13px;
  font-weight: 400;
  color: #606266;
}
.pv-total b {
  color: #f56c6c;
  font-size: 15px;
}
</style>
