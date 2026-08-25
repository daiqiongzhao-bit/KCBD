<template>
  <div
    class="upload-dropzone glass-sm"
    :class="{ 'is-dragover': dragover, 'is-disabled': disabled }"
    role="button"
    tabindex="0"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <input
      ref="inputRef"
      type="file"
      class="ud-input"
      :accept="accept"
      :disabled="disabled"
      @change="onChange"
    />
    <div class="ud-icon">
      <el-icon size="34"><UploadFilled /></el-icon>
    </div>
    <div class="ud-title">{{ title }}</div>
    <div class="ud-sub">{{ subtitle }}</div>
    <div v-if="fileName" class="ud-file glass">
      <el-icon><DocumentChecked /></el-icon>
      <span class="ud-file-name">{{ fileName }}</span>
      <el-icon class="ud-clear" title="移除" @click.stop="clear"><Close /></el-icon>
    </div>
    <div v-if="disabled" class="ud-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>处理中…</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { UploadFilled, DocumentChecked, Close, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = withDefaults(
  defineProps<{
    /** 接受的扩展名，逗号分隔，如 ".xlsx,.xls,.csv" */
    accept?: string;
    title?: string;
    subtitle?: string;
    /** 处理中禁用拖拽与点击 */
    disabled?: boolean;
    /** 已选文件（受控） */
    modelValue?: File | null;
  }>(),
  {
    accept: '.xlsx,.xls,.csv',
    title: '点击或拖拽文件到此处上传',
    subtitle: '支持 .xlsx / .xls / .csv 格式',
    disabled: false,
    modelValue: null,
  },
);

const emit = defineEmits<{
  select: [File];
  'update:modelValue': [File | null];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const dragover = ref(false);
const fileName = computed(() => props.modelValue?.name || '');

/** 校验扩展名是否在允许范围内。 */
const extOk = (name: string): boolean => {
  const exts = props.accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (exts.length === 0) return true;
  const lower = name.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
};

const handleFile = (file: File | null | undefined): void => {
  if (!file) return;
  if (!extOk(file.name)) {
    ElMessage.warning(`文件格式不支持，请上传 ${props.accept} 格式`);
    return;
  }
  emit('select', file);
  emit('update:modelValue', file);
};

const onClick = (): void => {
  if (props.disabled) return;
  inputRef.value?.click();
};

const onDragOver = (): void => {
  if (!props.disabled) dragover.value = true;
};

const onDragLeave = (): void => {
  dragover.value = false;
};

const onDrop = (e: DragEvent): void => {
  dragover.value = false;
  if (props.disabled) return;
  handleFile(e.dataTransfer?.files?.[0]);
};

const onChange = (e: Event): void => {
  const target = e.target as HTMLInputElement;
  handleFile(target.files?.[0]);
  // 允许重复选择同一文件触发 change
  target.value = '';
};

const clear = (): void => {
  emit('update:modelValue', null);
};
</script>

<style scoped>
.upload-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 34px 20px;
  border: 1.5px dashed rgba(91, 108, 255, 0.45);
  border-radius: var(--glass-radius);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  outline: none;
}
.upload-dropzone:hover,
.upload-dropzone:focus-visible {
  border-color: var(--accent, #5b6cff);
  background: rgba(91, 108, 255, 0.06);
}
.upload-dropzone.is-dragover {
  border-color: var(--accent, #5b6cff);
  background: rgba(91, 108, 255, 0.12);
  transform: scale(1.01);
}
.upload-dropzone.is-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.ud-input {
  display: none;
}
.ud-icon {
  color: var(--accent, #5b6cff);
}
.ud-title {
  font-weight: 600;
  color: var(--text-strong);
}
.ud-sub {
  font-size: 12px;
  color: var(--text-muted);
}
.ud-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-normal);
  max-width: 100%;
}
.ud-file-name {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ud-clear {
  cursor: pointer;
  color: var(--text-muted);
}
.ud-clear:hover {
  color: #f56c6c;
}
.ud-loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--accent, #5b6cff);
}
</style>
