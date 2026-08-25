import { defineStore } from 'pinia';
import type { WarehouseType } from '@/types';

export const useUiStore = defineStore('ui', {
  state: () => ({
    warehouse: 'normal' as WarehouseType,
    collapsed: false,
  }),
  actions: {
    setWarehouse(w: WarehouseType) {
      this.warehouse = w;
    },
    toggle() {
      this.collapsed = !this.collapsed;
    },
  },
});
