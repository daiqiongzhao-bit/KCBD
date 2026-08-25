<template>
  <div class="bg-canvas">
    <div class="bg-blob b1"></div>
    <div class="bg-blob b2"></div>
    <div class="bg-blob b3"></div>
    <div class="bg-blob b4"></div>
  </div>
  <div class="blank-wrap">
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.blank-wrap {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
</style>
