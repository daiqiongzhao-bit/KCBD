<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import { useUserStore } from '@/stores/user';
import { getToken } from '@/utils/auth';

onMounted(async () => {
  const token = getToken();
  if (token) {
    await useUserStore().fetchProfile();
  }
});
</script>
