<template>
  <div class="login-wrap">
    <div class="bg-canvas">
      <div class="bg-blob b1"></div>
      <div class="bg-blob b2"></div>
      <div class="bg-blob b3"></div>
    </div>
    <div class="login-card glass">
      <div class="lc-logo">
        <span class="logo-dot"></span> 库存对账系统
      </div>
      <div class="lc-sub">Inventory Reconciliation</div>
      <el-form :model="form" class="lc-form" @submit.prevent="onSubmit">
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            :prefix-icon="Lock"
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="lc-btn"
          :loading="loading"
          @click="onSubmit"
        >
          登&nbsp;&nbsp;录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const { login } = useAuth();

const form = reactive({ username: '', password: '' });
const loading = ref(false);

const onSubmit = async () => {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    await login(form.username, form.password);
    // 登录成功：先跳转再提示（让用户感觉"立即进入"，而不是被 toast 阻塞）
    const redirect = (route.query.redirect as string) || '/dashboard';
    router.replace(redirect);
    ElMessage.success('登录成功');
  } catch {
    /* 错误提示由响应拦截器统一处理 */
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-wrap {
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.login-card {
  position: relative;
  z-index: 1;
  width: 360px;
  padding: 36px 32px;
  border-radius: var(--glass-radius);
  text-align: center;
}
.lc-logo {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.logo-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5b6cff, #ff9ecb);
}
.lc-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin: 6px 0 22px;
  letter-spacing: 1px;
}
.lc-form {
  text-align: left;
}
.lc-btn {
  width: 100%;
}
</style>
