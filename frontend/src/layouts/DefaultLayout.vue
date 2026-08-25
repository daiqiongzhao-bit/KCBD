<template>
  <div class="bg-canvas">
    <div class="bg-blob b1"></div>
    <div class="bg-blob b2"></div>
    <div class="bg-blob b3"></div>
    <div class="bg-blob b4"></div>
  </div>
  <el-container class="layout">
    <el-aside :width="ui.collapsed ? '72px' : '232px'" class="aside glass">
      <div class="logo">
        <el-icon size="20" class="logo-svg"><component :is="LogoIcon" /></el-icon>
        <span v-show="!ui.collapsed" class="logo-text">库存对账</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="ui.collapsed"
        class="side-menu"
        background-color="transparent"
        text-color="#3a4156"
        active-text-color="#5b6cff"
        router
      >
        <el-menu-item
          v-for="item in visibleMenus"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
      <div class="side-foot" v-show="!ui.collapsed">库存对账系统 {{ appVersion }}</div>
    </el-aside>

    <el-container>
      <el-header class="header glass-sm">
        <div class="header-left">
          <el-button text @click="ui.toggle()">
            <el-icon size="20"><Fold v-if="!ui.collapsed" /><Expand v-else /></el-icon>
          </el-button>
          <img src="/logo.svg" class="app-logo" alt="logo" />
          <span class="header-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <el-radio-group
            :model-value="ui.warehouse"
            @update:model-value="onWarehouse"
            size="small"
          >
            <el-radio-button label="normal">正常仓</el-radio-button>
            <el-radio-button label="expired">临期仓</el-radio-button>
          </el-radio-group>

          <el-badge :value="unread" :hidden="unread === 0" class="bell">
            <el-popover placement="bottom-end" :width="340" trigger="click">
              <template #reference>
                <el-button circle text>
                  <el-icon size="18"><Bell /></el-icon>
                </el-button>
              </template>
              <div class="notify-panel">
                <div class="notify-head">
                  <span>通知</span>
                  <span class="notify-actions">
                    <span class="notify-count">未读 {{ unread }}</span>
                    <el-button
                      v-if="unread > 0"
                      link
                      type="primary"
                      size="small"
                      @click.stop="readAll"
                    >
                      全部已读
                    </el-button>
                  </span>
                </div>
                <el-scrollbar max-height="320px">
                  <div
                    v-for="n in notifications"
                    :key="n.id"
                    class="notify-item"
                    :class="{ unread: !n.is_read }"
                    @click="read(n)"
                  >
                    <div class="notify-title">{{ n.title }}</div>
                    <div class="notify-msg">{{ n.message }}</div>
                    <div class="notify-time">{{ formatDateTime(n.created_at) }}</div>
                  </div>
                  <div v-if="notifications.length === 0" class="notify-empty">
                    暂无通知
                  </div>
                </el-scrollbar>
              </div>
            </el-popover>
          </el-badge>

          <el-dropdown @command="onCommand">
            <span class="user-chip">
              <el-avatar :size="30" class="user-avatar">
                {{ userInitial }}
              </el-avatar>
              <span class="user-name">{{ userStore.user?.display_name }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile" disabled>
                  角色：{{ roleLabel }}
                </el-dropdown-item>
                <el-dropdown-item command="password" divided>
                  修改密码
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
      <el-form :model="pwdForm" label-width="90px">
        <el-form-item label="原密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="submitPwd">
          确定
        </el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';
import { useAuth } from '@/composables/useAuth';
import * as notifyApi from '@/api/notify';
import * as authApi from '@/api/auth';
import * as metaApi from '@/api/meta';
import { formatDateTime } from '@/utils/format';
import type { Notification, Role } from '@/types';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const ui = useUiStore();
const { logout } = useAuth();

// logo SVG 内联组件：仓库轮廓 + EOP→WMS 对账箭头 + 对勾
const LogoIcon = {
  template: `<svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
        <stop stop-color="#5b6cff"/>
        <stop offset="1" stop-color="#7c3aed"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="48" fill="url(#logoGrad)"/>
    <!-- 仓库外轮廓 -->
    <path d="M128 38L38 98v120h76v-52h28v52h76V98L128 38z"
          stroke="#fff" stroke-width="18" stroke-linejoin="round" fill="none" opacity="0.95"/>
    <!-- 屋顶中脊线 -->
    <path d="M128 38 L128 86" stroke="#fff" stroke-width="18" stroke-linecap="round" opacity="0.55"/>
    <!-- 对账箭头（EOP→WMS） -->
    <g transform="translate(128,152)">
      <path d="M-48 0 L48 0" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
      <polygon points="48,-14 74,0 48,14" fill="#fff"/>
      <!-- 反向回勾（双向核对语义） -->
      <path d="M-10 -26 Q-30 -46 -10 -66"
            stroke="#ffd166" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.95"/>
      <polygon points="-22,-58 -6,-76 6,-58" fill="#ffd166" opacity="0.95"/>
    </g>
    <!-- EOP/WMS 两个小方块 -->
    <rect x="64" y="182" width="36" height="36" rx="10" fill="#fff" opacity="0.88"/>
    <rect x="156" y="182" width="36" height="36" rx="10" fill="#fff" opacity="0.52"/>
    <!-- 对勾 -->
    <path d="M72 200 L82 210 L104 188"
          stroke="#7df9a8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95"/>
  </svg>`,
};

const menus = [
  { path: '/dashboard', title: '仪表盘', icon: 'Odometer' },
  { path: '/inventory', title: '库存', icon: 'Box' },
  { path: '/products', title: '商品主档信息管理', icon: 'Goods' },
  { path: '/reconcile', title: '库存对账', icon: 'Histogram' },
  { path: '/report', title: '对账报告', icon: 'Document' },
  { path: '/diff', title: '差异处理', icon: 'Warning' },
  { path: '/unsorted', title: '未分拣监控', icon: 'Box' },
  { path: '/returns', title: '退货在途', icon: 'RefreshLeft' },
  { path: '/expiry', title: '效期预警', icon: 'AlarmClock' },
  { path: '/logs', title: '操作日志', icon: 'Document' },
  { path: '/users', title: '账号与权限管理', icon: 'User', roles: ['admin'] },
  { path: '/settings', title: '系统设置', icon: 'Setting', roles: ['admin'] },
];

const visibleMenus = computed(() =>
  menus.filter((m) => !m.roles || userStore.hasRole(...(m.roles as Role[]))),
);

const currentTitle = computed(() => (route.meta.title as string) || '库存对账');
const roleLabelMap: Record<Role, string> = {
  admin: '系统管理员',
  warehouse: '仓库管理员',
  finance: '财务人员',
  manager: '管理层',
};
const roleLabel = computed(() =>
  userStore.role ? roleLabelMap[userStore.role] : '',
);
const userInitial = computed(
  () => (userStore.user?.display_name || 'U').charAt(0).toUpperCase(),
);

const appVersion = ref('V0.0.14');
onMounted(() => {
  metaApi.getVersion().then((r) => (appVersion.value = r.version)).catch(() => {});
});

const notifications = ref<Notification[]>([]);
const unread = ref(0);

const loadNotifications = async () => {
  try {
    const res = await notifyApi.listNotifications({ page: 1, size: 20 });
    notifications.value = res.items;
    unread.value = res.unread;
  } catch {
    /* ignore */
  }
};

const read = async (n: Notification) => {
  if (!n.is_read) {
    await notifyApi.markRead(n.id);
    n.is_read = true;
    unread.value = Math.max(0, unread.value - 1);
  }
};

const readAll = async () => {
  try {
    await notifyApi.markAllRead();
    notifications.value.forEach((n) => (n.is_read = true));
    unread.value = 0;
  } catch {
    /* ignore */
  }
};

const onWarehouse = (w: 'normal' | 'expired') => {
  ui.setWarehouse(w);
};

const pwdVisible = ref(false);
const pwdLoading = ref(false);
const pwdForm = ref({ oldPassword: '', newPassword: '' });

const submitPwd = async () => {
  if (!pwdForm.value.oldPassword || !pwdForm.value.newPassword) {
    ElMessage.warning('请填写完整');
    return;
  }
  pwdLoading.value = true;
  try {
    await authApi.changePassword(pwdForm.value.oldPassword, pwdForm.value.newPassword);
    ElMessage.success('密码已修改');
    pwdVisible.value = false;
    pwdForm.value = { oldPassword: '', newPassword: '' };
  } finally {
    pwdLoading.value = false;
  }
};

const onCommand = async (cmd: string) => {
  if (cmd === 'password') pwdVisible.value = true;
  else if (cmd === 'logout') {
    await logout();
    router.push('/login');
  }
};

onMounted(() => {
  loadNotifications();
  setInterval(loadNotifications, 30000);
});
</script>

<style scoped>
.layout {
  height: 100vh;
}
.aside {
  margin: 12px;
  border-radius: var(--glass-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  font-weight: 700;
  font-size: 18px;
  color: var(--text-strong);
}
.logo-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5b6cff, #ff9ecb);
}
.logo-svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: block;
}
.side-menu {
  border-right: none;
  flex: 1;
}
.header {
  margin: 12px 12px 0;
  border-radius: var(--glass-radius-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.app-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.header-title {
  font-weight: 600;
  color: var(--text-strong);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-normal);
}
.user-avatar {
  background: linear-gradient(135deg, #5b6cff, #8af0c8);
  color: #fff;
}
.main {
  padding: 16px 12px 12px;
  overflow-y: auto;
}
.notify-panel {
  font-size: 13px;
}
.notify-head {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
}
.notify-count {
  color: var(--text-muted);
  font-weight: 400;
}
.notify-item {
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.6);
}
.notify-item.unread {
  background: rgba(91, 108, 255, 0.12);
}
.notify-title {
  font-weight: 600;
}
.notify-msg {
  color: var(--text-normal);
  margin: 2px 0;
}
.notify-time {
  color: var(--text-muted);
  font-size: 12px;
}
.notify-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 20px;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.side-foot {
  padding: 10px 16px;
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

</style>
