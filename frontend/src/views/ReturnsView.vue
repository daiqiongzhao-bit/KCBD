<template>
  <div class="page-container">
    <PageToolbar title="退货在途" subtitle="EOP 退货在途与 WMS 等效库存差异（按仓库维度汇总）">
      <template #actions>
        <el-button :loading="exporting" :disabled="!items.length" @click="exportData">导出 CSV</el-button>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageToolbar>
    <div class="filter-bar">
      <el-radio-group v-model="warehouse" size="small" @change="load">
        <el-radio-button value="">全部仓库</el-radio-button>
        <el-radio-button value="normal">正常仓</el-radio-button>
        <el-radio-button value="expired">临期仓</el-radio-button>
      </el-radio-group>
    </div>
    <div class="panel">
      <el-table :data="items" v-loading="loading" size="small" border max-height="600" show-summary :summary-method="summary">
      <el-table-column label="仓库" width="120">
        <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
      </el-table-column>
      <el-table-column prop="skuCount" label="SKU 数" width="100" align="right" />
      <el-table-column prop="eopReturn" label="EOP 退货在途" width="150" align="right" />
      <el-table-column prop="wmsEquivalent" label="WMS 等效库存" width="150" align="right" />
      <el-table-column label="缺口 (Gap)" width="140" align="right">
        <template #default="{ row }">
          <span :class="{ danger: Number(row.gap) > 0 }">{{ row.gap ?? '' }}</span>
        </template>
      </el-table-column>
    </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PageToolbar from '@/components/PageToolbar.vue';
import * as dashApi from '@/api/dashboard';
import type { ReturnsItem } from '@/types';

const items = ref<ReturnsItem[]>([]);
const loading = ref(false);
const exporting = ref(false);
const warehouse = ref('');

/** el-table 汇总行（按当前页/所有数据汇总数字列）。 */
const summary = ({ columns, data }: { columns: any[]; data: ReturnsItem[] }) => {
  const sums: string[] = [];
  columns.forEach((col, idx) => {
    if (idx === 0) {
      sums.push('合计');
    } else if (['skuCount', 'eopReturn', 'wmsEquivalent', 'gap'].includes(col.property)) {
      const key = col.property as keyof ReturnsItem;
      const total = data.reduce((sum, r) => sum + ((r[key] as number) || 0), 0);
      sums.push(total.toString());
    } else {
      sums.push('');
    }
  });
  return sums;
};

const load = async () => {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (warehouse.value) params.warehouse = warehouse.value;
    const res = await dashApi.getReturns(params);
    items.value = res.items;
  } finally {
    loading.value = false;
  }
};

/** 导出当前列表为 CSV（含 BOM，Excel 可直接打开中文不乱码） */
const exportData = () => {
  exporting.value = true;
  try {
    const headers = ['仓库', 'SKU 数', 'EOP 退货在途', 'WMS 等效库存', '缺口'];
    const rows = items.value.map((r) => [
      r.warehouse === 'normal' ? '正常仓' : '临期仓',
      r.skuCount,
      r.eopReturn ?? '',
      r.wmsEquivalent ?? '',
      r.gap ?? '',
    ]);
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[\",\n]/.test(s) ? `"${s.replace(/\"/g, '\"')}"` : s;
    };
    const csv = [headers, ...rows]
      .map((r) => r.map(esc).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `退货在途-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    exporting.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.danger {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
