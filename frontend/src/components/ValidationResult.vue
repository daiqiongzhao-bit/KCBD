<template>
  <div class="validation-result">
    <el-alert
      v-if="issues.length === 0"
      type="success"
      :closable="false"
      show-icon
      title="校验通过"
      description="未检测到必填缺失或格式异常的行，可继续导入。"
    />
    <div v-else class="vr-box glass">
      <el-alert
        class="vr-alert"
        type="error"
        :closable="false"
        show-icon
        :title="`发现 ${issues.length} 处问题`"
        :description="force ? '已勾选强制导入，问题行将被跳过。' : '请修正 Excel 后重新上传，或勾选强制导入以跳过问题行。'"
      />
      <el-table :data="issues" border stripe size="small" max-height="280">
        <el-table-column type="index" label="#" width="48" />
        <el-table-column prop="row" label="行号" width="80" />
        <el-table-column prop="field" label="字段" width="150" show-overflow-tooltip />
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Issue } from '@/types';

withDefaults(
  defineProps<{
    issues: Issue[];
    /** 是否处于强制导入模式（仅用于文案提示） */
    force?: boolean;
  }>(),
  { issues: () => [], force: false },
);
</script>

<style scoped>
.validation-result {
  width: 100%;
}
.vr-box {
  padding: 12px 14px;
  border-radius: var(--glass-radius);
}
.vr-alert {
  margin-bottom: 10px;
}
</style>
