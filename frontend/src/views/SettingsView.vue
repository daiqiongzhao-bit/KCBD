<template>
  <div class="page-container">
    <PageToolbar title="系统设置" subtitle="对账容差与告警阈值（管理员）" />
    <el-alert
      v-if="!isAdmin"
      type="warning"
      :closable="false"
      title="仅管理员可修改本页面配置"
      class="section-gap"
    />
    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <div class="panel">
          <div class="panel-title">对账差异率容差</div>
          <el-slider
            v-model="tolerancePct"
            :min="0"
            :max="10"
            :step="0.1"
            show-input
            @change="saveTolerance"
          />
          <div class="muted">差异率低于该阈值视为一致。当前：{{ tolerancePct }}%</div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12">
        <div class="panel">
          <div class="panel-title">告警阈值</div>
          <el-form :model="alertsForm" label-width="130px">
            <el-form-item label="未分拣超期(天)">
              <el-input-number
                v-model="alertsForm.unsortedOverdueDays"
                :min="0"
                :max="30"
                controls-position="right"
                @change="saveAlerts"
              />
            </el-form-item>
            <el-form-item label="效期预警(天)">
              <el-input-number
                v-model="alertsForm.expiryWarnDays"
                :min="1"
                :max="365"
                controls-position="right"
                @change="saveAlerts"
              />
            </el-form-item>
            <el-form-item label="效期紧急(天)">
              <el-input-number
                v-model="alertsForm.expiryUrgentDays"
                :min="1"
                :max="365"
                controls-position="right"
                @change="saveAlerts"
              />
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>

    <div class="panel danger-panel" v-if="isAdmin">
      <div class="panel-title">
        <span class="danger">数据维护</span>
        <span class="muted" style="margin-left: 8px">仅管理员</span>
      </div>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="按表清空（破坏性操作）"
        style="margin-bottom: 12px"
      >
        仅清空指定表的数据，其他表不受影响。
        提示：清空「EOP/WMS 库存」或「未分拣报表」会同步删除对应导入记录，之后可重新导入原文件（无需勾选强制覆盖）；清空「对账记录」不影响库存，可重新执行对账。
      </el-alert>
      <el-table :data="tableRows" size="small" border>
        <el-table-column label="表" prop="label" min-width="160" />
        <el-table-column label="当前行数" prop="count" width="120" align="right">
          <template #default="{ row }">{{ row.count.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="说明" prop="desc" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="danger"
              text
              :loading="row.loading"
              :disabled="row.count === 0 || clearingTable"
              @click="onClearTable(row)"
            >
              清空
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 12px">
        <el-button :loading="loadingCounts" @click="loadTableCounts">刷新行数</el-button>
      </div>
    </div>

    <div class="panel danger-panel" v-if="isAdmin">
      <div class="panel-title">
        <span class="danger">一键清空</span>
        <span class="muted" style="margin-left: 8px">仅管理员</span>
      </div>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="危险操作：清除所有业务数据"
        style="margin-bottom: 12px"
      >
        将删除全部：库存快照（EOP/WMS/未分拣）、商品主档、对账记录、差异处理、赠品主档、操作日志、导入批次。
        <b>不会</b>删除：用户、角色权限、通知、告警配置。不可恢复，请确认后再操作。
      </el-alert>
      <el-button type="danger" :loading="clearing" @click="onClearAll">
        清空所有业务数据
      </el-button>
      <span class="muted" style="margin-left: 12px">建议操作前手动导出需要保留的数据</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import * as settingsApi from '@/api/settings';
import * as dashApi from '@/api/dashboard';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const isAdmin = computed(() => userStore.role === 'admin');

const tolerancePct = ref(0.5);
const alertsForm = reactive({
  unsortedOverdueDays: 3,
  expiryWarnDays: 90,
  expiryUrgentDays: 30,
});

const load = async () => {
  const t = await settingsApi.getTolerance();
  tolerancePct.value = +(Number(t.diffRateTolerance) * 100).toFixed(2);
  const a = await settingsApi.getAlerts();
  alertsForm.unsortedOverdueDays = a.unsortedOverdueDays;
  alertsForm.expiryWarnDays = a.expiryWarnDays;
  alertsForm.expiryUrgentDays = a.expiryUrgentDays;
};

const saveTolerance = async () => {
  if (!isAdmin.value) return;
  try {
    await settingsApi.putTolerance(Number((tolerancePct.value / 100).toFixed(4)));
    ElMessage.success('容差已保存');
  } catch {
    /* 拦截器提示 */
  }
};

const saveAlerts = async () => {
  if (!isAdmin.value) return;
  try {
    await settingsApi.putAlerts({ ...alertsForm });
    ElMessage.success('阈值已保存');
  } catch {
    /* 拦截器提示 */
  }
};

const clearing = ref(false);
/** 清空所有业务数据（二次确认） */
const onClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将清空全部库存快照、对账记录、商品主档、批次、操作日志、赠品等业务数据，保留用户/角色/通知/告警配置。\n\n清空后不可恢复，请确认已导出需要保留的数据。',
      '确认清空所有业务数据',
      { type: 'warning', confirmButtonText: '我已确认，清空', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return;
  }
  // 二次确认（必须输入 CLEAR）
  try {
    await ElMessageBox.confirm(
      '最后确认：执行清空？\n\n确认后系统将删除上述所有业务数据。',
      '最后确认',
      { type: 'error', confirmButtonText: '确认清空', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return;
  }
  clearing.value = true;
  try {
    const res = await dashApi.clearAllData();
    ElMessage.success(`已清空 ${res.clearedTables.length} 张业务表`);
    loadTableCounts();
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '清空失败';
    ElMessage.error(msg);
  } finally {
    clearing.value = false;
  }
};

/** 单表清空（按表清空）。 */
const TABLE_META: { key: string; label: string; desc: string }[] = [
  { key: 'eop_inventory', label: 'EOP 库存', desc: 'EOP 账面库存快照，清空后需重新导入 EOP 文件' },
  { key: 'wms_inventory', label: 'WMS 库存', desc: 'WMS 实物库存快照，清空后需重新导入 WMS 文件' },
  { key: 'wms_unsorted_order', label: '未分拣报表', desc: '未分拣出库单行明细，清空后需重新导入' },
  { key: 'inventory_reconcile', label: '对账记录', desc: 'EOP vs WMS 对账结果，清空后重新执行对账即可' },
  { key: 'products', label: '商品主档', desc: 'SKU 档案/赠品标记/条码，清空后重新导入会自动重建' },
  { key: 'gift_skus', label: '赠品主档', desc: '赠品关联表，清空后从 products.is_gift=true 重建' },
  { key: 'upload_batches', label: '导入批次', desc: '导入历史记录（清空后库存行也被级联删除）' },
];
const tableRows = ref<{ key: string; label: string; desc: string; count: number; loading: boolean }[]>([]);
const loadingCounts = ref(false);
const clearingTable = ref(false);

const loadTableCounts = async () => {
  if (!isAdmin.value) return;
  loadingCounts.value = true;
  try {
    const counts = await dashApi.getTableCounts();
    tableRows.value = TABLE_META.map((m) => ({
      ...m,
      count: counts[m.key] ?? 0,
      loading: false,
    }));
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '加载行数失败';
    ElMessage.error(msg);
  } finally {
    loadingCounts.value = false;
  }
};

// 用 any 兜底 el-table slot 的 DefaultRow 推断限制；运行时字段已由 tableRows 保证
const onClearTable = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认清空「${row.label}」（${row.count.toLocaleString()} 行）？\n\n清空后不可恢复，请确认已导出需要保留的数据。`,
      `清空 ${row.label}`,
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return;
  }
  row.loading = true;
  clearingTable.value = true;
  try {
    const res = await dashApi.clearTable(row.key);
    const batchMsg = res.batchesDeleted ? `，同步删除 ${res.batchesDeleted.toLocaleString()} 条导入记录` : '';
    ElMessage.success(`已清空「${row.label}」${res.deleted.toLocaleString()} 行${batchMsg}`);
    loadTableCounts();
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '清空失败';
    ElMessage.error(msg);
  } finally {
    row.loading = false;
    clearingTable.value = false;
  }
};

onMounted(() => {
  load();
  loadTableCounts();
});
</script>
