<template>
  <div class="formula-viz glass">
    <div class="fv-title">对账公式可视化</div>
    <div class="fv-cols">
      <div class="fv-col">
        <div class="fv-side">EOP（账面）</div>
        <div class="fv-metric">
          <span class="fv-m-label">账面库存 stock</span>
          <span class="fv-m-val">{{ formatNumber(data.eopStock) }}</span>
        </div>
        <div class="fv-metric">
          <span class="fv-m-label">实物库存 actual</span>
          <span class="fv-m-val">{{ formatNumber(data.eopActual) }}</span>
        </div>
      </div>
      <div class="fv-op">≈</div>
      <div class="fv-col">
        <div class="fv-side">WMS（系统）</div>
        <div class="fv-metric">
          <span class="fv-m-label">总库存 total</span>
          <span class="fv-m-val">{{ formatNumber(data.wmsTotal) }}</span>
        </div>
        <div class="fv-metric">
          <span class="fv-m-label">可用库存 available</span>
          <span class="fv-m-val">{{ formatNumber(data.wmsAvailable) }}</span>
        </div>
      </div>
    </div>
    <div class="fv-foot">
      <span>差异值 diff = stock − total = <b>{{ formatNumber(diffValue) }}</b></span>
      <span>实际差异 = actual − available = <b>{{ formatNumber(diffActual) }}</b></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '@/utils/format';
import type { FormulaData } from '@/types';

const props = defineProps<{ data: FormulaData }>();

const diffValue = computed(() =>
  Number(props.data.eopStock) - Number(props.data.wmsTotal),
);
const diffActual = computed(() =>
  Number(props.data.eopActual) - Number(props.data.wmsAvailable),
);
</script>

<style scoped>
.formula-viz {
  padding: 18px 20px;
  border-radius: var(--glass-radius);
  /* 与左侧差异趋势面板（height=320px）等高对齐：最小高度 + flex 垂直均分 */
  min-height: 360px;
  display: flex;
  flex-direction: column;
}
.fv-title {
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 14px;
}
.fv-cols {
  display: flex;
  align-items: stretch;
  gap: 14px;
  flex: 1;
}
.fv-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fv-side {
  font-size: 12px;
  color: var(--text-muted);
}
.fv-metric {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.55);
}
.fv-m-label {
  color: var(--text-normal);
  font-size: 13px;
}
.fv-m-val {
  font-weight: 700;
  color: var(--text-strong);
}
.fv-op {
  align-self: center;
  font-size: 22px;
  color: var(--accent, #5b6cff);
  font-weight: 700;
}
.fv-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 14px;
  font-size: 13px;
  color: var(--text-normal);
}
.fv-foot b {
  color: var(--accent, #5b6cff);
}
</style>
