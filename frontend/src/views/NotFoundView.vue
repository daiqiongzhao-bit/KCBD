<template>
  <div class="nf-wrap">
    <div class="bg-canvas">
      <div class="bg-blob b1"></div>
      <div class="bg-blob b2"></div>
    </div>
    <div class="nf-card glass">
      <div class="nf-code">{{ code || 404 }}</div>
      <div class="nf-title">{{ code === 403 ? '无访问权限' : '页面不存在' }}</div>
      <div class="nf-sub">
        {{ code === 403 ? '您没有访问该页面的权限' : '您访问的页面不存在或已被移除' }}
      </div>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const code = computed(() => (route.meta.code as number) || null);
const goHome = () => router.replace('/dashboard');
</script>

<style scoped>
.nf-wrap {
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.nf-card {
  position: relative;
  z-index: 1;
  width: 380px;
  padding: 40px 32px;
  border-radius: var(--glass-radius);
  text-align: center;
}
.nf-code {
  font-size: 72px;
  font-weight: 800;
  background: linear-gradient(135deg, #5b6cff, #ff9ecb);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.nf-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-strong);
  margin-top: 4px;
}
.nf-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin: 8px 0 22px;
}
</style>
