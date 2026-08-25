<template>
  <div class="page-container">
    <PageToolbar title="效期预警" subtitle="临期仓赠品效期分布与告警" />
    <div class="stat-row">
      <div v-for="b in buckets" :key="b.daysToExpire" class="glass bucket">
        <div class="bk-label">{{ b.label }}</div>
        <div class="bk-count">{{ b.count }}</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">效期告警明细</div>
      <el-table :data="alerts" v-loading="loading" size="small" border max-height="560" @selection-change="(rows: ExpiryAlert[]) => (selected = rows)">
        <el-table-column type="selection" width="48" />
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="warehouse" label="仓库" width="90">
          <template #default="{ row }">{{ row.warehouse === 'normal' ? '正常仓' : '临期仓' }}</template>
        </el-table-column>
        <el-table-column prop="sku_code" label="商品编码" width="140" />
        <el-table-column prop="barcode" label="商品条码" width="150" />
        <el-table-column prop="sku_name" label="中文名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="效期" width="120">
          <template #default="{ row }">{{ formatDate(row.expiration_date) }}</template>
        </el-table-column>
        <el-table-column prop="available_qty" label="数量" width="90" align="right" />
        <el-table-column prop="daysToExpire" label="剩余天数" width="90" align="right" />
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="levelType(row.level)" size="small" effect="light">{{ levelLabel(row.level) }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PageToolbar from '@/components/PageToolbar.vue';
import * as dashApi from '@/api/dashboard';
import { formatDate } from '@/utils/format';
import type { ExpiryBucket, ExpiryAlert } from '@/types';

const buckets = ref<ExpiryBucket[]>([]);
const alerts = ref<ExpiryAlert[]>([]);
const selected = ref<ExpiryAlert[]>([]);
const loading = ref(false);

const load = async () => {
  loading.value = true;
  try {
    const res = await dashApi.getExpiry();
    buckets.value = res.buckets;
    alerts.value = res.items;
  } finally {
    loading.value = false;
  }
};
const levelType = (lvl: string): 'success' | 'warning' | 'danger' =>
  lvl === 'urgent' || lvl === 'expired'
    ? 'danger'
    : lvl === 'warn'
      ? 'warning'
      : 'success';
const levelLabel = (lvl: string): string =>
  lvl === 'urgent'
    ? '紧急'
    : lvl === 'expired'
      ? '已过期'
      : lvl === 'warn'
        ? '警告'
        : '正常';

onMounted(load);
</script>

<style scoped>
.bucket {
  padding: 16px 20px;
  border-radius: var(--glass-radius);
  min-width: 140px;
  flex: 1;
}
.bk-label {
  font-size: 13px;
  color: var(--text-muted);
}
.bk-count {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-strong);
}
</style>
