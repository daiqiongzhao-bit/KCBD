<template>
  <div class="field-mapping glass">
    <div class="fm-title">字段映射（Excel 表头 → 系统字段）</div>
    <div class="fm-grid">
      <div v-for="field in fields" :key="field" class="fm-item">
        <div class="fm-target">
          <span class="fm-label">{{ labelOf(field) }}</span>
          <code class="fm-field">{{ field }}</code>
          <el-tag v-if="isRequired(field)" size="small" type="danger" effect="plain">必填</el-tag>
        </div>
        <el-select
          :model-value="mapping[field] || ''"
          placeholder="选择来源表头"
          clearable
          size="default"
          @update:model-value="(v: unknown) => onPick(field, v as string)"
        >
          <el-option v-for="h in headers" :key="h" :label="h" :value="h" />
        </el-select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    source: 'eop' | 'wms' | 'gift' | 'unsorted';
    /** Excel 实际表头列表 */
    headers: string[];
    /** 模板字段 → 来源表头的映射 */
    mapping: Record<string, string>;
  }>(),
  { headers: () => [], mapping: () => ({}) },
);

const emit = defineEmits<{
  'update:mapping': [Record<string, string>];
}>();

/** 各来源对应的模板字段（与后端 TEMPLATE_FIELDS 保持一致；仓库类型由导入页选择器提供，不在此列）。 */
const TEMPLATE_FIELDS: Record<string, string[]> = {
  eop: ['sku_code', 'sku_name', 'stock_qty', 'actual_qty', 'return_qty'],
  wms: ['sku_code', 'sku_name', 'stock_qty', 'unsorted_qty'],
  gift: ['sku_code', 'sku_name'],
  unsorted: ['sku_code', 'sku_name', 'unsorted_qty'],
};

/**
 * 必填字段（与后端 REQUIRED_FIELDS 保持一致）。
 * 注意：仓库类型（warehouse）已不在可映射字段中（由导入页选择器提供），故不在此列。
 * WMS 的 stock_qty / unsorted_qty 各自可选（库存模板仅 onHandQty，未分拣模板仅「数量」），
 * 因此均不作为必填。unsorted 类型必填 unsorted_qty（出库单行必须有数量）。
 */
const REQUIRED_FIELDS: Record<string, string[]> = {
  eop: ['sku_code', 'stock_qty', 'actual_qty'],
  wms: ['sku_code'],
  gift: ['sku_code'],
  unsorted: ['sku_code', 'unsorted_qty'],
};

/** 字段中文标签。 */
const FIELD_LABELS: Record<string, string> = {
  sku_code: 'SKU 编码',
  sku_name: '商品名称',
  warehouse: '仓库类型',
  stock_qty: '总库存',
  actual_qty: '实物库存',
  return_qty: '退货/在途',
  unsorted_qty: '未分拣数量',
  effective_date: '效期/生效日期',
};

const fields = computed(() => TEMPLATE_FIELDS[props.source] || []);
const required = computed(() => REQUIRED_FIELDS[props.source] || []);

const labelOf = (f: string): string => FIELD_LABELS[f] || f;
const isRequired = (f: string): boolean => required.value.includes(f);

/** 选择来源表头后，更新映射并向上抛出新对象（保持不可变）。 */
const onPick = (field: string, value: string): void => {
  const next: Record<string, string> = { ...props.mapping };
  if (!value) delete next[field];
  else next[field] = value;
  emit('update:mapping', next);
};
</script>

<style scoped>
.field-mapping {
  padding: 16px 18px;
  border-radius: var(--glass-radius);
}
.fm-title {
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 14px;
}
.fm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.fm-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fm-target {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fm-label {
  font-size: 13px;
  color: var(--text-normal);
  font-weight: 500;
}
.fm-field {
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(120, 130, 160, 0.12);
  padding: 1px 6px;
  border-radius: 6px;
}
</style>
