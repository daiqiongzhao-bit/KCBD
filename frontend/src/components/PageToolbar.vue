<template>
  <div class="page-toolbar">
    <div class="pt-left">
      <h2 class="pt-title">{{ title }}</h2>
      <span v-if="subtitle" class="pt-sub">{{ subtitle }}</span>
    </div>
    <div class="pt-right">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<style scoped>
.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.pt-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.pt-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-strong);
}
.pt-sub {
  font-size: 13px;
  color: var(--text-muted);
}
.pt-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
