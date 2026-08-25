<template>
  <div class="page-container">
    <PageToolbar title="对账报告" subtitle="汇总统计与差异明细">
      <template #actions>
        <el-button :loading="exporting" @click="onExport">导出 Excel</el-button>
        <el-button type="primary" :loading="running" @click="onRun">
          <el-icon><Refresh /></el-icon> 重新对账
        </el-button>
      </template>
    </PageToolbar>

    <div class="stats-grid" v-loading="loading">
      <el-card shadow="hover" class="stat-card">
        <div class="stat-label">总 SKU 数</div>
        <div class="stat-value">{{ summary.total || '-' }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-card">
        <div class="stat-label">匹配率</div>
        <div class="stat-value" :class="{ ok: summary.matchRate >= 95, warn: summary.matchRate < 90 }">
          {{ summary.matchRate }}%
        </div>
      </el-card>
      <el-card shadow="hover" class="stat-card success">
        <div class="stat-label">一致</div>
        <div class="stat-value">{{ summary.match }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-card danger">
        <div class="stat-label">多</div>
        <div class="stat-value">{{ summary.more }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-card danger">
        <div class="stat-label">少</div>
        <div class="stat-value">{{ summary.less }}</div>
      </el-card>
    </div>

    <el-alert
      v-if="summary.batchId"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      :title="`最近对账批次 ID: ${summary.batchId}`"
    />

    <div class="panel">
      <div class="panel-title">差异明细（Top 20）</div>
      <el-table
        :data="details"
        size="small"
        border
        v-loading="loading"
        empty-text="暂无差异数据"
      >
        <el-table-column prop="sku_code" label="SKU 编码" width="160" />
        <el-table-column prop="sku_name" label="商品名称" min-width="180" show-overflow-tooltip />
        <el-table-column label="赠品" width="70">
          <template #default="{ row }">{{ row.is_gift ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="diff_value" label="差异值" width="100">
          <template #default="{ row }">
            <span :class="row.diff_value > 0 ? 'text-more' : 'text-less'">
              {{ row.diff_value > 0 ? '+' : '' }}{{ row.diff_value }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="diff_value_actual" label="实际差异" width="100" />
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.diff_type === 'more' ? 'danger' : 'warning'" size="small">
              {{ row.diff_type === 'more' ? '多' : '少' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="possible_cause" label="可能原因" show-overflow-tooltip />
        <el-table-column prop="reconciled_at" label="对账时间" width="160">
          <template #default="{ row }">{{ formatDateTime(row.reconciled_at) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import * as reconcileApi from '@/api/reconcile';
import { useUiStore } from '@/stores/ui';
import { formatDateTime } from '@/utils/format';
import { downloadBlob } from '@/utils/download';

const ui = useUiStore();

const loading = ref(false);
const running = ref(false);
const exporting = ref(false);
const summary = ref<{ total: number; match: number; more: number; less: number; matchRate: number; batchId: number | null }>({
  total: 0, match: 0, more: 0, less: 0, matchRate: 0, batchId: null,
});
const details = ref<reconcileApi.ReportDetail[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const res = await reconcileApi.getReport(ui.warehouse);
    summary.value = res;
    details.value = res.detail || [];
  } finally {
    loading.value = false;
  }
};

const onRun = async () => {
  running.value = true;
  try {
    const s = await reconcileApi.runReconcile({ warehouse: ui.warehouse });
    ElMessage.success(`对账完成：合计 ${s.total}，一致 ${s.match}，多 ${s.more}，少 ${s.less}`);
    load();
  } finally {
    running.value = false;
  }
};

const onExport = async () => {
  exporting.value = true;
  try {
    const blob = await reconcileApi.exportReconcile({ warehouse: ui.warehouse });
    downloadBlob(blob, `report-${Date.now()}.xlsx`);
  } finally {
    exporting.value = false;
  }
};

onMounted(load);
watch(() => ui.warehouse, load);
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
  padding: 16px 8px;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
}
.stat-value.ok { color: #67c23a; }
.stat-value.warn { color: #e6a23c; }
.stat-card.success .stat-value { color: #67c23a; }
.stat-card.danger .stat-value { color: #f56c6c; }
.text-more { color: #f56c6c; font-weight: 600; }
.text-less { color: #e6a23c; font-weight: 600; }
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
</style>
