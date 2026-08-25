<template>
  <div class="page-container">
    <PageToolbar title="差异处理" subtitle="标注差异原因与处理状态" />
    <div class="filter-bar">
      <el-select v-model="status" placeholder="状态" clearable style="width:160px" @change="reload">
        <el-option label="全部" value="" />
        <el-option label="差异" value="diff" />
      </el-select>
      <el-button @click="reload">查询</el-button>
    </div>
    <div class="panel">
      <div class="batch-bar">
        <span class="batch-info">已选 <b>{{ selected.length }}</b> 行</span>
        <el-button type="primary" :disabled="!selected.length" @click="openBatch">批量处理</el-button>
        <el-button :disabled="!selected.length" @click="onClearSelection">清空选择</el-button>
      </div>
      <el-table :data="items" v-loading="loading" size="small" border max-height="560" @selection-change="(rows: InventoryReconcile[]) => (selected = rows)">
        <el-table-column type="selection" width="48" />
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">{{ (page - 1) * size + $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="仓库" width="90">
          <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
        </el-table-column>
        <el-table-column prop="sku_code" label="商品编码" width="160" />
        <el-table-column prop="diff_value" label="差异值" width="100" />
        <el-table-column prop="diff_value_actual" label="实际差异" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <DiffBadge :status="row.status" :diff-type="row.diff_type" />
          </template>
        </el-table-column>
        <el-table-column prop="possible_cause" label="可能原因" show-overflow-tooltip />
        <el-table-column label="处理状态" width="100">
          <template #default="{ row }">{{ row.handleStatus || '未处理' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <el-button text type="primary" size="small">操作 &#9662;</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openHandle(row)">处理</el-dropdown-item>
                  <el-dropdown-item @click="openTimeline(row)">时间线</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <PageBar
        :total="total"
        :selected="selected.length"
        :current-page="page"
        :page-size="size"
        @change="onPage"
        @size-change="onSizeChange"
      />
    </div>

    <el-dialog v-model="dlg" title="差异处理">
      <el-form :model="form" label-width="90px">
        <el-form-item label="差异原因">
          <el-select v-model="form.cause" placeholder="选择原因">
            <el-option label="入库漏记" value="missing_inbound" />
            <el-option label="出库漏记" value="missing_outbound" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.note" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="form.status">
            <el-option label="已处理" value="resolved" />
            <el-option label="跟进中" value="processing" />
            <el-option label="挂起" value="pending" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量处理弹窗 -->
    <el-dialog v-model="batchDlg" title="批量处理差异" width="460">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        :title="`将对已选 ${selected.length} 行差异应用同一处理（写审计时间线）`"
        style="margin-bottom: 14px"
      />
      <el-form :model="batchForm" label-width="90px">
        <el-form-item label="差异原因">
          <el-select v-model="batchForm.cause" placeholder="选择原因">
            <el-option label="入库漏记" value="missing_inbound" />
            <el-option label="出库漏记" value="missing_outbound" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="batchForm.note" type="textarea" :rows="2" placeholder="可选，批量处理备注" />
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="batchForm.status">
            <el-option label="已处理" value="resolved" />
            <el-option label="跟进中" value="processing" />
            <el-option label="挂起" value="pending" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDlg = false">取消</el-button>
        <el-button type="primary" :loading="batchSaving" @click="submitBatch">确定</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="tlVisible" title="处理时间线" size="420px">
      <el-timeline v-if="timeline.length">
        <el-timeline-item
          v-for="(t, i) in timeline"
          :key="i"
          :timestamp="formatDateTime(t.created_at)"
        >
          <div>状态：{{ t.status }}</div>
          <div>原因：{{ t.cause }}</div>
          <div>说明：{{ t.note }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无处理记录" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import DiffBadge from '@/components/DiffBadge.vue';
import * as diffApi from '@/api/diff';
import { useUiStore } from '@/stores/ui';
import { formatDateTime } from '@/utils/format';
import { PAGE_SIZE_OPTIONS, normalizeSize } from '@/utils/page';
import type { InventoryReconcile, DiffHandling } from '@/types';

const ui = useUiStore();
const items = ref<InventoryReconcile[]>([]);
const selected = ref<InventoryReconcile[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(100);
const status = ref('');

const dlg = ref(false);
const saving = ref(false);
const currentId = ref(0);
const form = ref({ cause: 'other', note: '', status: 'resolved' });

/** 批量处理状态 */
const batchDlg = ref(false);
const batchSaving = ref(false);
const batchForm = ref({ cause: 'other', note: '', status: 'resolved' });

const tlVisible = ref(false);
const timeline = ref<DiffHandling[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const res = await diffApi.listDiff({
      warehouse: ui.warehouse,
      status: status.value || undefined,
      page: page.value,
      size: normalizeSize(size.value),
    });
    items.value = res.items as InventoryReconcile[];
    total.value = res.total;
    selected.value = [];
  } finally {
    loading.value = false;
  }
};
const reload = () => {
  page.value = 1;
  load();
};
const onPage = (p: number) => {
  page.value = p;
  load();
};
const onSizeChange = (s: number) => {
  size.value = s;
  page.value = 1;
  load();
};
const onClearSelection = () => {
  selected.value = [];
};

const openHandle = (row: any) => {
  currentId.value = row.id;
  form.value = {
    cause: (row.handleCause as string) || 'other',
    note: row.latestNote || '',
    status: row.handleStatus || 'resolved',
  };
  dlg.value = true;
};
const submit = async () => {
  saving.value = true;
  try {
    await diffApi.handleDiff(currentId.value, form.value);
    ElMessage.success('已提交处理');
    dlg.value = false;
    load();
  } finally {
    saving.value = false;
  }
};

/** 批量处理：打开弹窗。 */
const openBatch = () => {
  batchForm.value = { cause: 'other', note: '', status: 'resolved' };
  batchDlg.value = true;
};
const submitBatch = async () => {
  if (!selected.value.length) return;
  batchSaving.value = true;
  try {
    const res = await diffApi.handleDiffBatch(
      selected.value.map((r) => r.id),
      batchForm.value,
    );
    ElMessage.success(`批量处理完成：成功 ${res.ok} 行，失败 ${res.fail} 行`);
    batchDlg.value = false;
    selected.value = [];
    load();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '批量处理失败');
  } finally {
    batchSaving.value = false;
  }
};

const openTimeline = async (row: any) => {
  const res = await diffApi.getDiffTimeline(row.id);
  timeline.value = res.timeline;
  tlVisible.value = true;
};

onMounted(load);
watch(() => ui.warehouse, reload);
</script>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  margin-bottom: 10px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.batch-info {
  font-size: 13px;
  color: #606266;
}
.batch-info b {
  color: #5b6cff;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
