<template>
  <div class="page-container">
    <PageToolbar title="商品主档信息管理" subtitle="维护商品主数据，支持导入/编辑/删除，按类型区分正品与赠品">
      <template #actions>
        <el-radio-group v-model="tab" size="default">
          <el-radio-button value="normal">正品</el-radio-button>
          <el-radio-button value="gift">赠品</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="keyword"
          placeholder="编码 / 名称 / 条码"
          clearable
          style="width: 200px"
          @keyup.enter="load"
        />
        <el-button @click="load">查询</el-button>
        <el-button type="primary" @click="openAdd">新增</el-button>
        <el-button @click="importVisible = true">导入</el-button>
      </template>
    </PageToolbar>
    <div class="panel">
      <div class="batch-bar">
        <span class="batch-info">已选 <b>{{ selected.length }}</b> 行</span>
        <el-button type="danger" :disabled="!selected.length" @click="onBatchRemove">批量删除</el-button>
        <el-button :disabled="!selected.length" @click="onClearSelection">清空选择</el-button>
      </div>
      <el-table :data="items" v-loading="loading" size="small" border max-height="560" @selection-change="(rows: Product[]) => (selected = rows)">
        <el-table-column type="selection" width="48" />
        <el-table-column label="序号" width="64" align="center">
          <template #default="{ $index }">{{ (page - 1) * size + $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="sku_code" label="商品编码" width="150" />
        <el-table-column prop="barcode" label="商品条码" width="150" />
        <el-table-column prop="sku_name" label="中文名称" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_gift ? 'warning' : 'success'">
              {{ row.is_gift ? '赠品' : '正品' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <el-button text type="primary" size="small">操作 &#9662;</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openEdit(row)">编辑</el-dropdown-item>
                  <el-dropdown-item divided @click="remove(row)" style="color: var(--el-color-danger)">删除</el-dropdown-item>
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dlg" :title="editId ? '编辑商品' : '新增商品'" width="420">
      <el-form :model="form" label-width="90px">
        <el-form-item label="商品编码">
          <el-input v-model="form.sku_code" :disabled="!!editId" placeholder="唯一编码" />
        </el-form-item>
        <el-form-item label="中文名称">
          <el-input v-model="form.sku_name" />
        </el-form-item>
        <el-form-item label="商品条码">
          <el-input v-model="form.barcode" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.is_gift">
            <el-radio :value="false">正品</el-radio>
            <el-radio :value="true">赠品</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 导入弹窗 -->
    <el-dialog v-model="importVisible" title="导入商品主档" width="480">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="文件需包含「商品编码」列，可选「中文名称」「商品条码」列（xlsx/xls/csv，≤10MB）"
        style="margin-bottom: 14px"
      />
      <div class="imp-tpl">
        <el-button text type="primary" size="small" @click="onDownloadTemplate">
          <el-icon><Download /></el-icon> 下载导入模板
        </el-button>
      </div>
      <el-upload
        drag
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls,.csv"
        :on-change="onFileChange"
        :on-remove="() => (importFile = null)"
      >
        <el-icon style="font-size: 42px; color: #909399"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或<em>点击选择</em></div>
      </el-upload>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importFile" @click="doImport">
          开始导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UploadFilled, Download } from '@element-plus/icons-vue';
import { downloadProductTemplate } from '@/importTemplates';
import type { UploadFile } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import * as inventoryApi from '@/api/inventory';
import { formatDateTime } from '@/utils/format';
import { PAGE_SIZE_OPTIONS, normalizeSize } from '@/utils/page';
import type { Product } from '@/types';

const tab = ref<'normal' | 'gift'>('normal');
const items = ref<Product[]>([]);
const selected = ref<Product[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(100);
const keyword = ref('');

const dlg = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);
const form = ref({ sku_code: '', sku_name: '', barcode: '', is_gift: false });

const importVisible = ref(false);
const importing = ref(false);
const importFile = ref<File | null>(null);

const load = async () => {
  loading.value = true;
  try {
    const res = await inventoryApi.listProducts({
      isGift: tab.value === 'gift' ? 'true' : 'false',
      keyword: keyword.value || undefined,
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
/** 批量删除商品（逐行调用）。 */
const onBatchRemove = async () => {
  if (!selected.value.length) return;
  try {
    await ElMessageBox.confirm(
      `确认批量删除 ${selected.value.length} 个商品？`,
      '批量删除确认',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  let ok = 0;
  let fail = 0;
  for (const r of selected.value) {
    try {
      await inventoryApi.deleteProduct(r.id);
      ok++;
    } catch {
      fail++;
    }
  }
  if (ok) ElMessage.success(`已删除 ${ok} 个`);
  if (fail) ElMessage.warning(`失败 ${fail} 个`);
  selected.value = [];
  load();
};
watch(tab, () => {
  page.value = 1;
  load();
});

const openAdd = () => {
  editId.value = null;
  form.value = { sku_code: '', sku_name: '', barcode: '', is_gift: tab.value === 'gift' };
  dlg.value = true;
};
const openEdit = (row: any) => {
  editId.value = row.id;
  form.value = {
    sku_code: row.sku_code,
    sku_name: row.sku_name,
    barcode: row.barcode || '',
    is_gift: row.is_gift,
  };
  dlg.value = true;
};
const submit = async () => {
  if (!form.value.sku_code) {
    ElMessage.warning('请输入商品编码');
    return;
  }
  saving.value = true;
  try {
    if (editId.value) {
      await inventoryApi.updateProduct(editId.value, {
        sku_name: form.value.sku_name,
        barcode: form.value.barcode,
        is_gift: form.value.is_gift,
      });
    } else {
      await inventoryApi.createProduct({
        sku_code: form.value.sku_code,
        sku_name: form.value.sku_name,
        barcode: form.value.barcode,
        is_gift: form.value.is_gift,
      });
    }
    ElMessage.success('已保存');
    dlg.value = false;
    load();
  } finally {
    saving.value = false;
  }
};
const remove = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认删除商品 ${row.sku_code}？被赠品关联的商品不能删除`,
      '删除',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await inventoryApi.deleteProduct(row.id);
    ElMessage.success('已删除');
    load();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '删除失败');
  }
};

const onFileChange = (f: UploadFile) => {
  importFile.value = (f.raw as File) || null;
};
const onDownloadTemplate = () => {
  downloadProductTemplate();
  ElMessage.success('已下载商品主档导入模板');
};
const doImport = async () => {
  if (!importFile.value) return;
  importing.value = true;
  try {
    const res = await inventoryApi.importProducts(importFile.value);
    ElMessage.success(
      `导入完成：共 ${res.total} 行，成功 ${res.imported}，跳过 ${res.skipped}`,
    );
    importVisible.value = false;
    importFile.value = null;
    load();
  } finally {
    importing.value = false;
  }
};

onMounted(load);
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
.imp-tpl {
  text-align: right;
  margin-bottom: 8px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
