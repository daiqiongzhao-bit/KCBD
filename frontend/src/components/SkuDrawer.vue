<template>
  <el-drawer
    :model-value="modelValue"
    :title="row ? `对账明细 · ${row.sku_code}` : '对账明细'"
    size="580px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="row" v-loading="loading" class="sku-drawer">
      <div class="sd-top">
        <DiffBadge :status="row.status" :diff-type="row.diff_type" />
        <el-tag v-if="row.is_gift" size="small" type="warning" effect="plain">赠品</el-tag>
        <el-tag size="small" effect="plain">
          {{ row.warehouse === 'expired' ? '临期仓' : '正常仓' }}
        </el-tag>
      </div>

      <FormulaViz :data="formula" />

      <div class="sd-section glass">
        <div class="sd-section-title">差异与判定</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="差异值">
            {{ formatNumber(row.diff_value) }}
          </el-descriptions-item>
          <el-descriptions-item label="实际差异">
            {{ formatNumber(row.diff_value_actual) }}
          </el-descriptions-item>
          <el-descriptions-item label="差异率">
            {{ formatPercent(row.diff_rate) }}
          </el-descriptions-item>
          <el-descriptions-item label="可能原因">
            {{ row.possible_cause || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="sd-section glass">
        <div class="sd-section-title">双侧明细（EOP 账面 vs WMS 系统）</div>
        <el-table :data="bothRows" border size="small">
          <el-table-column prop="field" label="字段" width="170" show-overflow-tooltip />
          <el-table-column prop="eop" label="EOP（账面）" show-overflow-tooltip />
          <el-table-column prop="wms" label="WMS（系统）" show-overflow-tooltip />
        </el-table>
      </div>

      <div v-if="row.handleStatus" class="sd-section glass">
        <div class="sd-section-title">处理状态</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="状态">{{ row.handleStatus }}</el-descriptions-item>
          <el-descriptions-item label="原因">{{ row.handleCause || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ row.latestNote || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import DiffBadge from './DiffBadge.vue';
import FormulaViz from './FormulaViz.vue';
import { getReconcile } from '@/api/reconcile';
import { formatNumber, formatPercent } from '@/utils/format';
import type { FormulaData, InventoryReconcile } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  row: InventoryReconcile | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
}>();

const loading = ref(false);
const detail = ref<InventoryReconcile | null>(null);

/** 打开抽屉时拉取最新明细；关闭时清空。 */
watch(
  () => [props.modelValue, props.row?.id] as const,
  async ([open, id]) => {
    if (open && id != null) {
      loading.value = true;
      try {
        detail.value = await getReconcile(id);
      } catch {
        // 拉取失败时回退到列表行数据
        detail.value = props.row;
      } finally {
        loading.value = false;
      }
    } else {
      detail.value = null;
    }
  },
  { immediate: true },
);

const base = computed(() => detail.value || props.row);

/** 优先使用后端返回的 formula，否则由对账行字段推导（后端 findOne 当前不返回 formula）。 */
const formula = computed<FormulaData>(() => {
  const d = base.value as (InventoryReconcile & { formula?: Record<string, number> }) | null;
  if (d?.formula && typeof d.formula === 'object' && Object.keys(d.formula).length) {
    return d.formula as unknown as FormulaData;
  }
  return {
    eopStock: d?.eop_stock ?? 0,
    eopActual: d?.eop_actual ?? 0,
    wmsTotal: d?.wms_total ?? 0,
    wmsAvailable: d?.wms_available ?? 0,
  };
});

interface BothRow {
  field: string;
  eop: string;
  wms: string;
}

/** 优先使用后端返回的 bothSides，否则由对账行字段推导。 */
const bothRows = computed<BothRow[]>(() => {
  const d = base.value as (InventoryReconcile & { bothSides?: Record<string, unknown> }) | null;
  if (d?.bothSides && typeof d.bothSides === 'object') {
    return Object.entries(d.bothSides).map(([field, value]) => {
      if (value && typeof value === 'object') {
        const v = value as Record<string, unknown>;
        return {
          field,
          eop: v.eop != null ? String(v.eop) : '-',
          wms: v.wms != null ? String(v.wms) : '-',
        };
      }
      return { field, eop: '-', wms: String(value) };
    });
  }
  return [
    { field: '总库存 stock', eop: formatNumber(d?.eop_stock), wms: formatNumber(d?.wms_total) },
    { field: '实物库存 actual', eop: formatNumber(d?.eop_actual), wms: formatNumber(d?.wms_available) },
    { field: '退货/在途 return', eop: formatNumber(d?.eop_return), wms: '-' },
    { field: '未分拣 unsorted', eop: '-', wms: formatNumber(d?.wms_unsorted) },
  ];
});
</script>

<style scoped>
.sku-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sd-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sd-section {
  padding: 14px 16px;
  border-radius: var(--glass-radius);
}
.sd-section-title {
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 10px;
}
</style>
