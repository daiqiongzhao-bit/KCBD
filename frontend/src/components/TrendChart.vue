<template>
  <AppChart :option="option" :height="height" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppChart from './AppChart.vue';
import type { TrendPoint } from '@/types';

const props = defineProps<{ data: TrendPoint[]; height?: string }>();

const option = computed(() => {
  const dates = props.data.map((d) => d.date);
  const rates = props.data.map((d) => +(Number(d.diffRate) * 100).toFixed(2));
  const skus = props.data.map((d) => d.diffSku);
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['差异率%', '差异SKU'], textStyle: { color: '#3a4156' } },
    grid: { left: 48, right: 48, top: 44, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#3a4156' },
      boundaryGap: true,
    },
    yAxis: [
      {
        type: 'value',
        name: '差异率%',
        axisLabel: { color: '#3a4156' },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
      },
      {
        type: 'value',
        name: 'SKU',
        axisLabel: { color: '#3a4156' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '差异率%',
        type: 'line',
        smooth: true,
        data: rates,
        itemStyle: { color: '#5b6cff' },
        lineStyle: { width: 3 },
        areaStyle: { color: 'rgba(91,108,255,0.15)' },
      },
      {
        name: '差异SKU',
        type: 'bar',
        yAxisIndex: 1,
        data: skus,
        itemStyle: { color: '#ff9ecb', borderRadius: [4, 4, 0, 0] },
        barWidth: '40%',
      },
    ],
  };
});
</script>
