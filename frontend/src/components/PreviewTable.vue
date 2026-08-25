<template>
  <div class="preview-table glass">
    <div class="pt-head">
      <span class="pt-title">数据预览</span>
      <span class="pt-info">共 {{ rows.length }} 行，仅展示前 {{ display }} 行</span>
    </div>
    <el-table :data="sliced" border stripe height="320" size="small" empty-text="暂无预览数据">
      <el-table-column type="index" label="#" width="50" />
      <el-table-column
        v-for="h in headers"
        :key="h"
        :prop="h"
        :label="h"
        show-overflow-tooltip
        min-width="110"
      />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    headers: string[];
    rows: Record<string, string>[];
    maxRows?: number;
  }>(),
  { headers: () => [], rows: () => [], maxRows: 8 },
);

const display = computed(() => Math.min(props.maxRows, props.rows.length));
const sliced = computed(() => props.rows.slice(0, props.maxRows));
</script>

<style scoped>
.preview-table {
  padding: 14px 16px;
  border-radius: var(--glass-radius);
}
.pt-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.pt-title {
  font-weight: 600;
  color: var(--text-strong);
}
.pt-info {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
