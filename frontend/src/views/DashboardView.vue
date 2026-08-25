<template>
  <div class="page-container">
    <PageToolbar title="仪表盘" :subtitle="warehouseLabel + ' 概览'" />
    <div class="overview-panel">
      <div class="ov-head">
        <span class="ov-title">总预览</span>
        <span class="ov-sub">关键指标概览（当前{{ warehouseLabel }}）</span>
      </div>
      <div class="ov-grid">
        <div class="ov-item">
          <span class="ov-label">SKU 总数</span>
          <span class="ov-value">{{ formatNumber(summary.totalSku) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">商品 SKU</span>
          <span class="ov-value">{{ formatNumber(summary.productSku) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">EOP 库存</span>
          <span class="ov-value">{{ formatNumber(summary.eopStock) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">WMS 库存</span>
          <span class="ov-value">{{ formatNumber(summary.wmsStock) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">赠品 SKU</span>
          <span class="ov-value">{{ formatNumber(summary.giftSku) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">未分拣量</span>
          <span class="ov-value">{{ formatNumber(summary.unsortedQty) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">差异 SKU</span>
          <span class="ov-value">{{ formatNumber(summary.diffSku) }}</span>
        </div>
        <div class="ov-item">
          <span class="ov-label">差异率</span>
          <span class="ov-value">{{ formatPercent(summary.diffRate) }}</span>
        </div>
        <div class="ov-item ov-warn">
          <span class="ov-label">临期告警</span>
          <span class="ov-value">{{ formatNumber(summary.expiryAlert) }}</span>
        </div>
      </div>
    </div>
    <div class="stat-row">
      <StatCard label="SKU 总数" :value="summary.totalSku" icon="Box" accent="#5b6cff" />
      <StatCard label="EOP 库存" :value="formatNumber(summary.eopStock)" icon="Histogram" accent="#8af0c8" />
      <StatCard label="WMS 库存" :value="formatNumber(summary.wmsStock)" icon="Goods" accent="#ff9ecb" />
      <StatCard label="差异 SKU" :value="summary.diffSku" icon="Warning" accent="#ffb86b" />
      <StatCard label="差异率" :value="formatPercent(summary.diffRate)" icon="PieChart" accent="#c08bff" />
    </div>
    <el-row :gutter="16" class="row-equal">
      <el-col :xs="24" :lg="14">
        <div class="panel">
          <div class="panel-title">差异趋势</div>
          <TrendChart :data="trend" height="320px" />
        </div>
      </el-col>
      <el-col :xs="24" :lg="10">
        <FormulaViz :data="formula" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageToolbar from '@/components/PageToolbar.vue';
import StatCard from '@/components/StatCard.vue';
import TrendChart from '@/components/TrendChart.vue';
import FormulaViz from '@/components/FormulaViz.vue';
import * as dashApi from '@/api/dashboard';
import { useUiStore } from '@/stores/ui';
import { formatNumber, formatPercent } from '@/utils/format';
import type {
  DashboardSummary,
  TrendPoint,
  FormulaData,
} from '@/types';

const ui = useUiStore();
const warehouseLabel = computed(() =>
  ui.warehouse === 'normal' ? '正常仓' : '临期仓',
);

const summary = ref<DashboardSummary>({
  totalSku: 0,
  eopStock: 0,
  wmsStock: 0,
  diffSku: 0,
  giftSku: 0,
  productSku: 0,
  unsortedQty: 0,
  expiryAlert: 0,
  diffRate: 0,
});
const trend = ref<TrendPoint[]>([]);
const formula = ref<FormulaData>({
  eopActual: 0,
  wmsAvailable: 0,
  eopStock: 0,
  wmsTotal: 0,
});

const load = async () => {
  const w = ui.warehouse;
  // 总览/统计卡片为全仓口径（不区分正常仓/临期仓），趋势与公式随页头切换
  const [s, t, f] = await Promise.all([
    dashApi.getSummary(),
    dashApi.getTrend({ warehouse: w }),
    dashApi.getFormula(w),
  ]);
  summary.value = s;
  trend.value = t;
  formula.value = f;
};

onMounted(load);
watch(() => ui.warehouse, load);
</script>

<style scoped>
.overview-panel {
  margin-bottom: 16px;
  border-radius: 14px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #eef1ff 0%, #f6f1ff 55%, #e9fbf3 100%);
  border: 1px solid #e4e7f5;
  box-shadow: 0 4px 14px rgba(91, 108, 255, 0.08);
}
.ov-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.ov-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.ov-sub {
  font-size: 12px;
  color: #909399;
}
.ov-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 900px) {
  .ov-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.ov-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid #ebeef5;
}
.ov-label {
  font-size: 12px;
  color: #909399;
}
.ov-value {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
  font-variant-numeric: tabular-nums;
}
.ov-warn .ov-value {
  color: #e6a23c;
}

/* 底部行（差异趋势 + 对账公式可视化）等高对齐 */
.row-equal {
  align-items: stretch;
}
.row-equal .panel {
  min-height: 360px;
  display: flex;
  flex-direction: column;
}
.row-equal .panel > .panel-title {
  flex-shrink: 0;
}
.row-equal .panel > *:last-child {
  flex: 1;
  min-height: 0;
}
</style>
