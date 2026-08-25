<template>
  <div class="page-container">
    <PageToolbar title="数据导入" subtitle="上传 EOP / WMS Excel，自动校验；对账请切换到「库存对账」页手动执行" />

    <el-row :gutter="16">
      <el-col :xs="24" :lg="9">
        <div class="panel">
          <div class="panel-title">1. 选择来源并上传</div>
          <el-radio-group v-model="source" class="section-gap" @change="resetPreview">
            <el-radio-button value="eop">EOP 库存</el-radio-button>
            <el-radio-button value="wms">WMS 库存</el-radio-button>
            <el-radio-button value="unsorted">未分拣报表</el-radio-button>
          </el-radio-group>

          <template v-if="source !== 'gift'">
            <div class="field-row">
              <span class="field-label">仓库类型</span>
              <el-select v-model="warehouse" placeholder="选择仓库类型" size="default">
                <el-option label="正常仓" value="normal" />
                <el-option label="临期仓" value="expired" />
              </el-select>
            </div>
            <div class="hint">
              真实模板（正常/临期仓库存、未分拣）不含「仓库类型」列，需在此手动指定。
            </div>
          </template>

          <template v-if="source === 'eop'">
            <div class="field-row">
              <el-checkbox v-model="isGift">标记为赠品</el-checkbox>
            </div>
            <div class="hint">
              上传文件名含「赠品」时自动勾选；勾选后该批 SKU 会被标记为赠品参与对账拆分。
            </div>
          </template>

          <template v-if="source === 'unsorted'">
            <div class="hint">
              未分拣出库单行（表头含「出库单号 / 波次号 / 快递单号 / 货品编码 / 货品名称 / 数量」），按所选仓库类型入库。
            </div>
          </template>

          <UploadDropzone @select="onSelect" />
          <div v-if="file" class="file-name">
            <el-icon><Document /></el-icon> {{ file.name }}
            <el-button text type="primary" @click="clearFile">移除</el-button>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :lg="15">
        <div class="panel">
          <div class="panel-title">2. 字段映射与预览</div>
          <template v-if="preview">
            <div class="filter-bar">
              <span class="muted">
                预览 {{ preview.previewRows.length }} 行 · 校验问题 {{ preview.issues.length }} 个
              </span>
            </div>
            <FieldMapping :source="source" :headers="preview.headers" v-model:mapping="mapping" />
            <el-collapse v-model="activePanel" class="section-gap">
              <el-collapse-item title="数据预览" name="preview">
                <PreviewTable :headers="preview.headers" :rows="preview.previewRows" />
              </el-collapse-item>
              <el-collapse-item title="校验结果" name="validation">
                <ValidationResult :issues="preview.issues" />
              </el-collapse-item>
            </el-collapse>
            <div class="actions">
              <el-button type="primary" :loading="importing" @click="onConfirm">
                确认导入
              </el-button>
              <el-checkbox v-model="force" class="muted">强制覆盖（忽略幂等）</el-checkbox>
            </div>
          </template>
          <el-empty v-else description="请先上传文件" />
        </div>
      </el-col>
    </el-row>

    <div class="panel section-gap">
      <div class="panel-title">下载导入模板</div>
      <div class="tpl-hint">
        下表头与字段顺序与系统解析逻辑完全一致，填写后导入即可正确识别。
      </div>
      <div class="tpl-grid">
        <div v-for="t in templates" :key="t.key" class="tpl-card">
          <div class="tpl-label">{{ t.label }}</div>
          <div class="tpl-desc">{{ t.description }}</div>
          <el-button size="small" type="primary" plain @click="download(t)">
            下载 {{ t.label }}.xlsx
          </el-button>
        </div>
      </div>
    </div>

    <div v-if="result" class="panel section-gap">
      <div class="panel-title">3. 导入结果</div>
      <el-alert
        v-if="result.idempotent"
        type="warning"
        :closable="false"
        title="该内容已导入过，已跳过重复写入"
        class="section-gap"
      />
      <el-descriptions :column="4" border>
        <el-descriptions-item label="批次 ID">{{ result.batch.id }}</el-descriptions-item>
        <el-descriptions-item label="有效行">{{ result.rowsValid }}</el-descriptions-item>
        <el-descriptions-item label="问题行">{{ result.rowsInvalid }}</el-descriptions-item>
        <el-descriptions-item label="对账">
          <template v-if="result.reconcileSummary">
            总计 {{ result.reconcileSummary.total }} / 一致
            {{ result.reconcileSummary.match }} / 多
            {{ result.reconcileSummary.more }} / 少
            {{ result.reconcileSummary.less }}
          </template>
          <template v-else>未触发</template>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="panel section-gap">
      <div class="panel-title">最近导入批次</div>
      <el-table :data="batches" size="small" border empty-text="暂无批次">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="source" label="来源" width="90" />
        <el-table-column prop="file_name" label="文件" show-overflow-tooltip />
        <el-table-column prop="row_count" label="总行数" width="90" />
        <el-table-column prop="rows_valid" label="有效" width="80" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column label="导入时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.imported_at) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import UploadDropzone from '@/components/UploadDropzone.vue';
import FieldMapping from '@/components/FieldMapping.vue';
import PreviewTable from '@/components/PreviewTable.vue';
import ValidationResult from '@/components/ValidationResult.vue';
import * as uploadApi from '@/api/upload';
import { IMPORT_TEMPLATES, downloadTemplate, type ImportTemplate } from '@/importTemplates';
import { formatDateTime } from '@/utils/format';
import type { PreviewResult, UploadBatch, SourceType } from '@/types';


const source = ref<SourceType>('eop');
const warehouse = ref<'normal' | 'expired'>('normal');
const isGift = ref(false);
const file = ref<File | null>(null);
const preview = ref<PreviewResult | null>(null);
const mapping = ref<Record<string, string>>({});
const force = ref(false);
const importing = ref(false);
const result = ref<any>(null);
const activePanel = ref(['preview', 'validation']);
const batches = ref<UploadBatch[]>([]);
const templates = IMPORT_TEMPLATES;

const onSelect = async (f: File) => {
  file.value = f;
  resetPreview();
  // 文件名含「赠品」时自动标记为赠品
  if (/赠品/.test(f.name)) isGift.value = true;
  try {
    const wh = source.value === 'gift' ? undefined : warehouse.value;
    const res = await uploadApi.previewUpload(f, source.value, wh);
    preview.value = res;
    mapping.value = res.suggestedMapping || {};
    if (res.issues.length > 0) {
      ElMessage.warning(`检测到 ${res.issues.length} 个校验问题，请检查映射`);
    }
  } catch {
    /* 拦截器已提示 */
  }
};

const download = (t: ImportTemplate) => {
  downloadTemplate(t);
  ElMessage.success(`已下载模板：${t.label}`);
};

const resetPreview = () => {
  preview.value = null;
  mapping.value = {};
  result.value = null;
};

const clearFile = () => {
  file.value = null;
  resetPreview();
};

const onConfirm = async () => {
  if (!file.value) return;
  if (preview.value && preview.value.issues.length > 0 && !force.value) {
    try {
      await ElMessageBox.confirm(
        '存在校验问题，仍要导入吗？可勾选「强制覆盖」忽略幂等校验。',
        '确认导入',
        { type: 'warning' },
      );
    } catch {
      return;
    }
  }
  importing.value = true;
  try {
    const wh = source.value === 'gift' ? undefined : warehouse.value;
    const res = await uploadApi.confirmUpload(file.value, source.value, mapping.value, {
      force: force.value,
      warehouse: wh,
      isGift: source.value === 'eop' ? isGift.value : undefined,
    });
    result.value = res;
    loadBatches();
    const r: any = res;
    const batchId = r?.batch?.id;
    const valid = r?.rowsValid ?? 0;
    const invalid = r?.rowsInvalid ?? 0;
    if (r?.idempotent) {
      ElMessageBox.alert(
        `内容已存在，已跳过重复导入（批次 #${batchId}）。\n\n如需查看新数据，请点击「数据导入」上方菜单「库存」。`,
        '已跳过',
        { type: 'info', confirmButtonText: '继续导入' },
      );
    } else {
      ElMessageBox.alert(
        `导入成功！\n\n有效行 ${valid} 条${
          invalid ? `，无效行 ${invalid} 条` : ''
        }。\n\n批次编号 #${batchId}\n\n本次导入不会自动对账，请到「库存对账」页点击「开始对账」。`,
        '导入成功',
        { type: 'success', confirmButtonText: '继续导入' },
      );
    }
  } catch (e: any) {
    const msg =
      e?.response?.data?.message || e?.message || '导入失败，请稍后重试';
    ElMessageBox.alert(msg, '导入失败', { type: 'error', confirmButtonText: '知道了' });
  } finally {
    importing.value = false;
  }
};

const loadBatches = async () => {
  const res = await uploadApi.listBatches({ page: 1, size: 8 });
  batches.value = res.items as UploadBatch[];
};

onMounted(loadBatches);
</script>

<style scoped>
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.field-label {
  font-size: 13px;
  color: var(--text-normal);
  font-weight: 500;
  min-width: 64px;
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  line-height: 1.5;
}
.tpl-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
  line-height: 1.5;
}
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.tpl-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpl-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-strong, #1f2937);
}
.tpl-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  flex: 1;
}
.file-name {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-normal);
  display: flex;
  align-items: center;
  gap: 6px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
}
</style>
