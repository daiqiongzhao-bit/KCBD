<template>
  <div class="page-container">
    <PageToolbar title="账号与权限管理" subtitle="账号增删改查、冻结、角色说明（密码在编辑弹窗内重置）">
      <template #actions>
        <el-input
          v-model="keyword"
          placeholder="用户名 / 姓名"
          clearable
          style="width: 180px"
          @keyup.enter="load"
        />
        <el-button @click="load">查询</el-button>
        <el-button type="primary" @click="openAdd">新增账号</el-button>
      </template>
    </PageToolbar>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="17">
        <div class="panel">
          <div class="panel-title">账号列表</div>
          <el-table :data="items" v-loading="loading" size="small" border max-height="520" style="width: 100%" @selection-change="(rows: User[]) => (selected = rows)">
            <el-table-column type="selection" width="48" />
            <el-table-column label="序号" width="64" align="center">
              <template #default="{ $index }">{{ (page - 1) * size + $index + 1 }}</template>
            </el-table-column>
            <el-table-column prop="username" label="用户名" min-width="120" />
            <el-table-column prop="display_name" label="姓名" min-width="100" />
            <el-table-column label="角色" min-width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ roleLabel(row.role) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === 'frozen' ? 'danger' : 'success'">
                  {{ row.status === 'frozen' ? '已冻结' : '正常' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-dropdown trigger="click">
                  <el-button text type="primary" size="small">操作 &#9662;</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="openEdit(row)">编辑</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.status === 'active' && row.id !== 1"
                        @click="toggleFreeze(row, true)"
                        style="color: var(--el-color-danger)"
                      >
                        冻结
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-else-if="row.status === 'frozen'"
                        @click="toggleFreeze(row, false)"
                        style="color: var(--el-color-success)"
                      >
                        解冻
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.id !== 1"
                        divided
                        @click="remove(row)"
                        style="color: var(--el-color-danger)"
                      >
                        删除
                      </el-dropdown-item>
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
      </el-col>
      <el-col :xs="24" :lg="7">
        <div class="panel">
          <div class="panel-title">角色权限</div>
          <div v-for="r in roles" :key="r.role" class="role-card">
            <div class="role-name">
              {{ r.name }}<span class="role-key">{{ r.role }}</span>
              <el-button
                v-if="isAdmin"
                text
                type="primary"
                size="small"
                style="float: right"
                @click="openPermCfg(r)"
              >
                配置权限
              </el-button>
            </div>
            <div class="role-desc">{{ r.description }}</div>
            <div class="role-perms">
              {{ permLabelList(r.role).join(' / ') || '（无权限）' }}
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 角色权限配置弹窗 -->
    <el-dialog
      v-model="permDlg"
      :title="`配置权限：${permRole ? permRole.name : ''}`"
      width="560"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="勾选该角色可访问的功能点，保存后立即生效（无需重启）"
        style="margin-bottom: 14px"
      />
      <div v-for="grp in permGroups" :key="grp.name" class="perm-group">
        <div class="perm-group-title">{{ grp.name }}</div>
        <div class="perm-group-items">
          <el-checkbox
            v-for="pt in grp.points"
            :key="pt.permission"
            :model-value="permChecked.includes(pt.permission)"
            @change="(v: boolean | string | number) => onPermToggle(pt.permission, !!v)"
          >
            {{ pt.name }}
          </el-checkbox>
        </div>
      </div>
      <template #footer>
        <el-button @click="permDlg = false">取消</el-button>
        <el-button type="primary" :loading="permSaving" @click="savePermCfg">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dlg" :title="editId ? '编辑账号' : '新增账号'" width="420">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" :disabled="!!editId" />
        </el-form-item>
        <el-form-item v-if="!editId" label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 8 位，含字母和数字" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.display_name" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="r in roles" :key="r.role" :label="r.name" :value="r.role" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editId" label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="frozen" :disabled="editId === 1">冻结</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editId" label="重置密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="留空表示不修改（至少 8 位，含字母和数字）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageToolbar from '@/components/PageToolbar.vue';
import PageBar from '@/components/PageBar.vue';
import * as usersApi from '@/api/users';
import { formatDateTime } from '@/utils/format';
import { getUser } from '@/utils/auth';
import { PAGE_SIZE_OPTIONS, normalizeSize } from '@/utils/page';
import type {
  User,
  RoleDefinition,
  PermissionPoint,
  Role,
} from '@/types';

const items = ref<User[]>([]);
const selected = ref<User[]>([]);
const roles = ref<RoleDefinition[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(100);
const keyword = ref('');

/** 当前登录用户是否为 admin（决定是否显示权限配置入口）。 */
const isAdmin = computed(() => getUser<{ role?: string }>()?.role === 'admin');

/** 全部权限点 + 各角色当前权限。 */
const permPoints = ref<PermissionPoint[]>([]);
const rolePerms = ref<Record<string, string[]>>({});

/** 权限点按分组。 */
const permGroups = computed(() => {
  const groups: { name: string; points: PermissionPoint[] }[] = [];
  for (const pt of permPoints.value) {
    let g = groups.find((x) => x.name === pt.group);
    if (!g) {
      g = { name: pt.group, points: [] };
      groups.push(g);
    }
    g.points.push(pt);
  }
  return groups;
});

/** 弹窗状态。 */
const permDlg = ref(false);
const permSaving = ref(false);
const permRole = ref<RoleDefinition | null>(null);
const permChecked = ref<string[]>([]);

/** 角色权限点 → 中文名列表（展示）。 */
const permLabelList = (role: string): string[] => {
  const perms = rolePerms.value[role] || [];
  return perms
    .map((p) => permPoints.value.find((x) => x.permission === p)?.name || p)
    .filter(Boolean);
};

const dlg = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);
const form = ref({
  username: '',
  password: '',
  display_name: '',
  role: 'warehouse' as Role,
  status: 'active' as 'active' | 'frozen',
});

const roleLabel = (r: string): string =>
  roles.value.find((x) => x.role === r)?.name || r;

const load = async () => {
  loading.value = true;
  try {
    const res = await usersApi.listUsers({
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

/** 加载权限点与各角色权限映射。 */
const loadPerms = async () => {
  try {
    permPoints.value = await usersApi.listPermissionPoints();
    const map = await usersApi.getAllRolePermissions();
    rolePerms.value = {};
    for (const m of map) rolePerms.value[m.role] = m.permissions;
  } catch {
    /* 权限接口异常时静默，不影响页面 */
  }
};

/** 打开角色权限配置弹窗。 */
const openPermCfg = (r: RoleDefinition) => {
  permRole.value = r;
  permChecked.value = [...(rolePerms.value[r.role] || [])];
  permDlg.value = true;
};

const onPermToggle = (permission: string, checked: boolean) => {
  if (checked) {
    if (!permChecked.value.includes(permission)) permChecked.value.push(permission);
  } else {
    permChecked.value = permChecked.value.filter((p) => p !== permission);
  }
};

const savePermCfg = async () => {
  if (!permRole.value) return;
  permSaving.value = true;
  try {
    const res = await usersApi.updateRolePermissions(
      permRole.value.role,
      permChecked.value,
    );
    rolePerms.value[permRole.value.role] = res.permissions;
    ElMessage.success('权限已更新');
    permDlg.value = false;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '保存失败');
  } finally {
    permSaving.value = false;
  }
};

const openAdd = () => {
  editId.value = null;
  form.value = { username: '', password: '', display_name: '', role: 'warehouse', status: 'active' };
  dlg.value = true;
};
const openEdit = (row: any) => {
  editId.value = row.id;
  form.value = {
    username: row.username,
    password: '',
    display_name: row.display_name,
    role: row.role,
    status: row.status,
  };
  dlg.value = true;
};
const submit = async () => {
  if (!form.value.username) {
    ElMessage.warning('请输入用户名');
    return;
  }
  saving.value = true;
  try {
    if (editId.value) {
      // 编辑：密码留空表示不修改，填写则必须 ≥ 6 位（弹窗里"重置密码"输入框复用同一字段）
      if (form.value.password && form.value.password.length < 8) {
        ElMessage.warning('密码至少 8 位，含字母和数字');
        return;
      }
      await usersApi.updateUser(editId.value, {
        display_name: form.value.display_name,
        role: form.value.role,
        status: form.value.status,
        password: form.value.password || undefined,
      });
    } else {
      if (!form.value.password || form.value.password.length < 8) {
        ElMessage.warning('密码至少 8 位，含字母和数字');
        return;
      }
      await usersApi.createUser({
        username: form.value.username,
        password: form.value.password,
        display_name: form.value.display_name,
        role: form.value.role,
      });
    }
    ElMessage.success('已保存');
    dlg.value = false;
    load();
  } finally {
    saving.value = false;
  }
};
const toggleFreeze = async (row: any, freeze: boolean) => {
  try {
    await ElMessageBox.confirm(
      `确认${freeze ? '冻结' : '解冻'}账号 ${row.username}？`,
      freeze ? '冻结' : '解冻',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await usersApi.updateUser(row.id, { status: freeze ? 'frozen' : 'active' });
  ElMessage.success(freeze ? '已冻结' : '已解冻');
  load();
};
const remove = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认删除账号 ${row.username}？`, '删除', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await usersApi.deleteUser(row.id);
  ElMessage.success('已删除');
  load();
};

onMounted(() => {
  load();
  usersApi.listRoles().then((r) => (roles.value = r));
  loadPerms();
});
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.role-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.role-name {
  font-weight: 600;
  font-size: 13px;
}
.role-key {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}
.role-desc {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
  line-height: 1.5;
}
.role-perms {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.perm-group {
  margin-bottom: 14px;
}
.perm-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.perm-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 10px 12px;
  background: #f8f9fc;
  border-radius: 8px;
}
</style>
