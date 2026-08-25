<template>
  <el-tag :type="tagType" :effect="effect" size="small" round>
    {{ label }}
  </el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReconcileStatus, DiffType } from '@/types';

const props = defineProps<{
  status: ReconcileStatus | string;
  diffType?: DiffType | string;
}>();

const label = computed(() => {
  if (props.status === 'match') return '一致';
  if (props.status === 'diff') {
    if (props.diffType === 'more') return '多';
    if (props.diffType === 'less') return '少';
  }
  return props.status || '-';
});

const tagType = computed<'success' | 'warning' | 'danger'>(() =>
  props.status === 'match'
    ? 'success'
    : 'danger',
);

const effect = 'light' as const;
</script>
