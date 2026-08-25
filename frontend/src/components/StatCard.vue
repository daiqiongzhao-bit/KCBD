<template>
  <div class="stat-card glass">
    <div v-if="icon" class="sc-icon" :style="iconStyle">
      <el-icon size="22"><component :is="icon" /></el-icon>
    </div>
    <div class="sc-body">
      <div class="sc-label">{{ label }}</div>
      <div class="sc-value" :style="{ color: accent || 'var(--text-strong)' }">
        {{ value }}
      </div>
      <div v-if="hint" class="sc-hint">{{ hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: string | number;
  icon?: string;
  accent?: string;
  hint?: string;
}>();

const iconStyle = computed(() => ({
  background: (props.accent || '#5b6cff') + '22',
  color: props.accent || '#5b6cff',
}));
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: var(--glass-radius);
  min-width: 200px;
  flex: 1;
}
.sc-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sc-label {
  font-size: 13px;
  color: var(--text-muted);
}
.sc-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
}
.sc-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
