import { defineStore } from 'pinia';
import type { WarehouseType, ReconcileStatus, DiffType } from '@/types';

export const useReconcileStore = defineStore('reconcile', {
  state: () => ({
    warehouse: 'normal' as WarehouseType,
    status: '' as ReconcileStatus | '',
    diffType: '' as DiffType | '',
    sku: '',
    sort: '',
  }),
  actions: {
    setWarehouse(w: WarehouseType) {
      this.warehouse = w;
    },
    reset() {
      this.status = '';
      this.diffType = '';
      this.sku = '';
      this.sort = '';
    },
  },
});
