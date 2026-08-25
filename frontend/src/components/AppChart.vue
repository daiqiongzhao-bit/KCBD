<template>
  <div ref="el" class="app-chart" :style="{ height: height || '320px' }"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

const props = defineProps<{ option: any; height?: string }>();

const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const render = () => {
  if (chart && props.option) {
    chart.setOption(props.option, true);
  }
};

const onResize = () => chart && chart.resize();

onMounted(() => {
  if (el.value) {
    chart = echarts.init(el.value);
    render();
  }
  window.addEventListener('resize', onResize);
});

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.app-chart {
  width: 100%;
}
</style>
