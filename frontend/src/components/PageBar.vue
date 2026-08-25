<!--
  全局统一分页器（紧凑型，贴近参考样式）
  - 用 Element Plus el-pagination 标准组件：total + sizes + prev + pager + next
  - 圆形页码（默认效果）+ 当前页加粗
  - 不加卡片外壳，紧贴表格底部，简洁扁平
  - 支持"全部数据"（size=0）：显示蓝色小标签替代翻页按钮组
  - 左侧显示「总计：X 已选：Y」统计信息
-->
<template>
  <div class="ir-pager">
    <div class="ir-pager__info">
      <span>总计：<b>{{ total }}</b></span>
      <span class="ir-pager__info-split">已选：<b>{{ selected }}</b></span>
    </div>
    <el-pagination
      v-if="pageSize !== 0"
      background
      layout="total, sizes, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="currentPage"
      :pager-count="5"
      :page-sizes="[100, 200, 1000, 2000]"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />
    <div v-else class="ir-pager__all">
      共 <b>{{ total }}</b> 条
      <span class="ir-pager__all-tag">全部数据</span>
      <el-select
        :model-value="pageSize"
        size="default"
        class="ir-pager__size"
        @change="onSizeChange"
      >
        <el-option
          v-for="opt in PAGE_SIZE_OPTIONS"
          :key="opt.value"
          :value="opt.value"
          :label="opt.label"
        />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElPagination, ElSelect, ElOption } from 'element-plus';
import { PAGE_SIZE_OPTIONS } from '@/utils/page';

withDefaults(
  defineProps<{
    total: number;
    currentPage: number;
    pageSize: number;
    selected?: number;
  }>(),
  { selected: 0 }
);

const emit = defineEmits<{
  change: [page: number];
  sizeChange: [size: number];
}>();

const onPageChange = (p: number) => emit('change', p);
const onSizeChange = (s: number) => {
  // 切到"全部数据"时回到第 1 页避免翻页错位
  emit('sizeChange', s);
  emit('change', 1);
};
</script>

<style scoped>
.ir-pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  gap: 16px;
}
.ir-pager__info {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
.ir-pager__info b {
  color: #303133;
  font-weight: 600;
  margin: 0 2px;
}
.ir-pager__info-split {
  padding-left: 16px;
  border-left: 1px solid #dcdfe6;
}
.ir-pager__all {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #909399;
}
.ir-pager__all b {
  color: #303133;
  font-weight: 600;
  margin: 0 2px;
}
.ir-pager__all-tag {
  font-size: 12px;
  color: #5b6cff;
  padding: 4px 10px;
  background: #eef1ff;
  border-radius: 12px;
  font-weight: 500;
}
.ir-pager__size {
  width: 130px;
}
.ir-pager__size :deep(.el-select__wrapper) {
  background: #fff;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

/* 防御性样式：确保分页器始终水平排列，不受全局/浏览器默认列表样式污染 */
.ir-pager :deep(.el-pagination),
.ir-pager :deep(.el-pager),
.ir-pager :deep(.el-pager li) {
  display: inline-flex;
  align-items: center;
}
.ir-pager :deep(.el-pager) {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-wrap: nowrap;
}
.ir-pager :deep(.el-pager li) {
  list-style: none;
  margin: 0 4px;
  padding: 0;
}
</style>