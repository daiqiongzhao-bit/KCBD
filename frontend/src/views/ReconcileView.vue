<template>
  <div class="page-container">
    <PageToolbar title="库存对账" subtitle="EOP 与 WMS 逐项核对">
      <template #actions>
        <el-button :loading="running" type="primary" @click="onRun">
          <el-icon><Refresh /></el-icon> 执行对账
        </el-button>
        <el-button :loading="exporting" @click="onExport">导出 Excel</el-button>
        <el-button type="danger" plain :loading="clearingAll" @click="onClearAll">
          <el-icon><Delete /></el-icon> 清空
        </el-button>
      </template>
    </PageToolbar>

    <div class="filter-bar">
      <el-radio-group v-model="giftMode">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="false">正品</el-radio-button>
        <el-radio-button value="true">赠品</el-radio-button>
      </el-radio-group>
      <el-select v-model="status" placeholder="状态" clearable style="width:140px" @change="reload">
        <el-option label="一致" value="match" />
        <el-option label="差异" value="diff" />
      </el-select>
      <el-select v-model="diffType" placeholder="差异类型" clearable style="width:140px" @change="reload">
        <el-option label="多" value="more" />
        <el-option label="少" value="less" />
      </el-select>
      <el-input
        v-model="sku"
        placeholder="SKU 编码"
        clearable
        style="width:180px"
        @keyup.enter="reload"
      />
      <el-button @click="reload">查询</el-button>
    </div>

    <div class="batch-bar">
      <el-checkbox
        :model-value="isAllSelected"
        :indeterminate="isIndeterminate"
        @change="onSelectAll"
      >
        全选
      </el-checkbox>
      <span class="batch-info">已选 <b>{{ selected.length }}</b> 行</span>
      <el-button
        type="primary"
        :disabled="!selected.length"
        :loading="batchClearing"
        @click="onBatchClear"
      >
        批量清除引用
      </el-button>
      <el-button :disabled="!selected.length" @click="onClearSelection">清空选择</el-button>
    </div>

    <div class="panel">
      <el-table
        ref="tableRef"
        :data="items"
        v-loading="loading"
        size="small"
        border
        show-summary
        :summary-method="summary"
        show-overflow-tooltip
        max-height="560"
        @row-click="onRow"
        @selection-change="(rows: InventoryReconcile[]) => (selected = rows)"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">
            {{ (page - 1) * size + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column label="仓库" width="90">
          <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
        </el-table-column>
        <el-table-column prop="sku_code" label="商品编码" width="160" />
        <el-table-column prop="sku_name" label="商品名称" min-width="180" show-overflow-tooltip />
        <el-table-column label="赠品" width="70">
          <template #default="{ row }">{{ row.is_gift ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="eop_stock" label="EOP库存" width="100" />
        <el-table-column prop="eop_actual" label="EOP实际库存" width="110" />
        <el-table-column prop="wms_total" label="WMS库存" width="100" />
        <el-table-column prop="wms_unsorted" label="WMS未分拣" width="105" />
        <el-table-column prop="eop_return" label="退货数量" width="100" />
        <el-table-column prop="diff_value" label="差异值" width="100" />
        <el-table-column label="退货比对" width="100">
          <template #default="{ row }">
            <span v-if="Number(row.eop_return || 0) > 0 && Number(row.diff_value || 0) > 0">
              {{ (Number(row.diff_value) - Number(row.eop_return)).toFixed(0) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="差异率" width="90">
          <template #default="{ row }">{{ formatPercent(row.diff_rate) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <DiffBadge :status="row.status" :diff-type="row.diff_type" />
          </template>
        </el-table-column>
        <el-table-column prop="possible_cause" label="可能原因" show-overflow-tooltip />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-tag v-if="row.cleared" size="small" type="info" effect="plain">已清除</el-tag>
            <el-button
              v-else
              text
              type="primary"
              size="small"
              :loading="clearingId === row.id"
              @click.stop="onClear(row)"
            >清除引用</el-button>
          </template>
        </el-table-column>
      </el-table>
      <PageBar
        :total="total"
        :selected="selected.length"
        :current-page="page"
        :page-size="size"
        @change="onPage"
        @size-change="onSizeChange"
      />
    </div>

    <SkuDrawer v-model="drawerVisible" :row="(detail as InventoryReconcile | null)" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import DiffBadge from '@/components/DiffBadge.vue';
import SkuDrawer from '@/components/SkuDrawer.vue';
import * as reconcileApi from '@/api/reconcile';
import { useUiStore } from '@/stores/ui';
import { formatPercent } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import { PAGE_SIZE_OPTIONS, normalizeSize } from '@/utils/page';
import { Delete } from '@element-plus/icons-vue';
import type { InventoryReconcile } from '@/types';

const ui = useUiStore();

const giftMode = ref('');
const status = ref('');
const diffType = ref('');
const sku = ref('');
const loading = ref(false);
const items = ref<InventoryReconcile[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(100);

/** 对账表格底部汇总：EOP 库存/EOP 实际/WMS 库存/WMS 未分拣/退货数量/差异值/差异率。差异率汇总为加权平均。 */
const summary = ({ columns, data }: { columns: any[]; data: InventoryReconcile[] }) => {
  const sums: string[] = [];
  const totalWmsTotal = data.reduce((s, r) => s + Number(r.wms_total || 0), 0);
  columns.forEach((col, idx) => {
    if (idx === 0) {
      sums.push('合计');
    } else if (['eop_stock', 'eop_actual', 'wms_total', 'wms_unsorted', 'eop_return', 'diff_value'].includes(col.property)) {
      const total = data.reduce((s, r) => s + Number((r as any)[col.property] || 0), 0);
      sums.push(total.toFixed(0));
    } else if (col.property === 'diff_rate') {
      // 差异率 = 差异值合计 / WMS 库存合计
      const totalDiff = data.reduce((s, r) => s + Number(r.diff_value || 0), 0);
      sums.push(totalWmsTotal > 0 ? ((totalDiff / totalWmsTotal) * 100).toFixed(2) + '%' : '0.00%');
    } else if (col.label === '序号') {
      sums.push(`${data.length} 行`);
    } else {
      sums.push('');
    }
  });
  return sums;
};

const running = ref(false);
const exporting = ref(false);
const clearingAll = ref(false);
const drawerVisible = ref(false);
const detail = ref<Record<string, any> | null>(null);

/** 多选状态 */
const tableRef = ref();
const selected = ref<InventoryReconcile[]>([]);
const isAllSelected = computed(() =>
  items.value.length > 0 && selected.value.length === items.value.length,
);
const isIndeterminate = computed(() =>
  selected.value.length > 0 && selected.value.length < items.value.length,
);
const onSelectAll = (val: boolean | string | number) => {
  if (val) {
    selected.value = [...items.value];
    items.value.forEach((row) => tableRef.value?.toggleRowSelection(row, true));
  } else {
    selected.value = [];
    items.value.forEach((row) => tableRef.value?.toggleRowSelection(row, false));
  }
};
const onClearSelection = () => {
  selected.value = [];
  items.value.forEach((row) => tableRef.value?.toggleRowSelection(row, false));
};

const clearingId = ref<number | null>(null);
const batchClearing = ref(false);

const params = () => ({
  warehouse: ui.warehouse,
  status: status.value || undefined,
  diffType: diffType.value || undefined,
  sku: sku.value || undefined,
  isGift: giftMode.value || undefined,
  page: page.value,
  size: normalizeSize(size.value),
});

const load = async () => {
  loading.value = true;
  try {
    const res = await reconcileApi.listReconcile(params());
    items.value = res.items as InventoryReconcile[];
    total.value = res.total;
    // 翻页后清空多选
    selected.value = [];
  } finally {
    loading.value = false;
  }
};

const reload = () => {
  page.value = 1;
  load();
};

const onPage = (p: number) => {
  page.value = p;
  load();
};

const onSizeChange = (s: number) => {
  size.value = s;
  page.value = 1;
  load();
};

/** 清空当前对账数据（当前仓库维度；二次确认）。 */
const onClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      `确认清空${ui.warehouse === 'expired' ? '临期仓' : '正常仓'}的全部对账数据？` +
        '清空后对账记录将被删除（不可恢复），库存快照数据不受影响。',
      '清空对账数据',
      {
        type: 'warning',
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
      },
    );
  } catch {
    return;
  }
  clearingAll.value = true;
  try {
    const res = await reconcileApi.clearAllReconcile(ui.warehouse);
    ElMessage.success(`已清空 ${res.deleted} 条对账记录`);
    onClearSelection();
    load();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '清空失败');
  } finally {
    clearingAll.value = false;
  }
};

const onRun = async () => {
  running.value = true;
  try {
    const summary = await reconcileApi.runReconcile({ warehouse: ui.warehouse });
    ElMessage.success(
      `对账完成：合计 ${summary.total}，一致 ${summary.match}，多 ${summary.more}，少 ${summary.less}`,
    );
    load();
  } finally {
    running.value = false;
  }
};

const onExport = async () => {
  exporting.value = true;
  try {
    const blob = await reconcileApi.exportReconcile(params());
    downloadBlob(blob, `reconcile-${Date.now()}.xlsx`);
  } finally {
    exporting.value = false;
  }
};

const onRow = async (row: InventoryReconcile) => {
  detail.value = (await reconcileApi.getReconcile(row.id)) as Record<string, any>;
  drawerVisible.value = true;
};

const onClear = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定清除「${row.sku_code}」(${row.warehouse === 'normal' ? '正常仓' : '临期仓'}) 的对账引用吗？清除后该库存行即可删除或切换仓库，对账记录仍保留。`,
      '清除对账引用',
      { type: 'warning', confirmButtonText: '清除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  clearingId.value = row.id;
  try {
    await reconcileApi.clearReference(row.id);
    ElMessage.success('已清除对账引用');
    load();
  } finally {
    clearingId.value = null;
  }
};

/** 批量清除对账引用：逐行调用，跳过已清除行。 */
const onBatchClear = async () => {
  const rows = selected.value.filter((r) => !r.cleared);
  if (!rows.length) {
    ElMessage.warning('所选行均已清除，无需重复操作');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认批量清除所选 ${rows.length} 行的对账引用？清除后该批对账行仍保留（标记为已清除），相关库存行可正常删除或切换仓库。`,
      '批量清除对账引用',
      { type: 'warning', confirmButtonText: '确认清除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  batchClearing.value = true;
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    try {
      await reconcileApi.clearReference(r.id);
      ok++;
    } catch {
      fail++;
    }
  }
  batchClearing.value = false;
  onClearSelection();
  load();
  if (fail === 0) {
    ElMessage.success(`已批量清除 ${ok} 行的对账引用`);
  } else {
    ElMessage.warning(`已清除 ${ok} 行，失败 ${fail} 行`);
  }
};

onMounted(load);
watch(() => ui.warehouse, reload);
watch(giftMode, reload);
</script>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.batch-info {
  font-size: 13px;
  color: #606266;
}
.batch-info b {
  color: #5b6cff;
  margin: 0 2px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
</style>
