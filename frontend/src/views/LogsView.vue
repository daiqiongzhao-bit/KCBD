<template>
  <div class="page-container">
    <PageToolbar title="操作日志" subtitle="系统内关键操作审计">
      <template #actions>
        <el-select
          v-model="filterUser"
          clearable
          filterable
          placeholder="操作人"
          style="width: 140px"
          @change="onFilter"
        >
          <el-option
            v-for="u in userOptions"
            :key="u.id"
            :label="u.display_name || u.username"
            :value="u.id"
          />
        </el-select>
        <el-select v-model="filterAction" clearable placeholder="动作" style="width: 130px" @change="onFilter">
          <el-option v-for="(label, key) in ACTION_LABELS" :key="key" :label="label" :value="key" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 250px"
          @change="onFilter"
        />
        <el-button type="primary" @click="onFilter">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </template>
    </PageToolbar>
    <div class="panel">
      <el-table :data="items" v-loading="loading" size="small" border max-height="600" @selection-change="(rows: OperationLog[]) => (selected = rows)">
        <el-table-column type="selection" width="48" />
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">{{ (page - 1) * size + $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="150">
          <template #default="{ row }">
            {{ row.operator_name || (row.user_id ? `用户#${row.user_id}` : '系统') }}
          </template>
        </el-table-column>
        <el-table-column label="动作" width="130">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="对象" width="160" show-overflow-tooltip />
        <el-table-column label="明细" show-overflow-tooltip>
          <template #default="{ row }">{{ detailText(row.detail) }}</template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import * as logsApi from '@/api/logs';
import * as usersApi from '@/api/users';
import { formatDateTime } from '@/utils/format';
import { PAGE_SIZE_OPTIONS, normalizeSize } from '@/utils/page';
import type { OperationLog, User } from '@/types';

const items = ref<OperationLog[]>([]);
const selected = ref<OperationLog[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(100);

const userOptions = ref<User[]>([]);
const filterUser = ref<number | undefined>(undefined);
const filterAction = ref<string | undefined>(undefined);
const dateRange = ref<[string, string] | null>(null);

/** 动作英文 → 中文描述。 */
const ACTION_LABELS: Record<string, string> = {
  login: '登录',
  logout: '退出登录',
  import: '数据导入',
  reconcile: '库存对账',
  diff_handle: '差异处理',
  'diff-handling': '差异处理',
  gift_add: '新增赠品',
  gift_update: '编辑赠品',
  gift_delete: '删除赠品',
  user_create: '新增账号',
  user_update: '编辑账号',
  user_freeze: '冻结账号',
  user_unfreeze: '解冻账号',
  user_delete: '删除账号',
  reset_password: '重置密码',
  change_password: '修改密码',
  settings_update: '更新设置',
  alert_update: '更新告警配置',
};

const load = async () => {
  loading.value = true;
  try {
    const res = await logsApi.listLogs({
      user: filterUser.value || undefined,
      action: filterAction.value || undefined,
      from: dateRange.value?.[0] || undefined,
      to: dateRange.value?.[1] || undefined,
      page: page.value,
      size: normalizeSize(size.value),
    });
    items.value = res.items;
    total.value = res.total;
    selected.value = [];
  } finally {
    loading.value = false;
  }
};
const onFilter = () => {
  page.value = 1;
  load();
};
const reset = () => {
  filterUser.value = undefined;
  filterAction.value = undefined;
  dateRange.value = null;
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
const detailText = (d: unknown) => (d ? JSON.stringify(d) : '-');
const actionLabel = (a: string): string => ACTION_LABELS[a] || a;

onMounted(() => {
  load();
  usersApi.listUsers({ page: 1, size: 500 }).then((r) => (userOptions.value = r.items));
});
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
