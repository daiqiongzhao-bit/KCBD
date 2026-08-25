import { reactive, ref } from 'vue';

/**
 * 通用表格分页 / 排序 / 筛选封装。
 * fetchFn(page, size, sort) => Promise<{items, total}>
 */
export function useTable<T>(
  fetchFn: (page: number, size: number, sort: string) => Promise<{ items: T[]; total: number }>,
) {
  const items = ref<T[]>([]) as { value: T[] };
  const total = ref(0);
  const loading = ref(false);
  const page = ref(1);
  const size = ref(20);
  const sort = ref('');

  const refresh = async () => {
    loading.value = true;
    try {
      const res = await fetchFn(page.value, size.value, sort.value);
      items.value = res.items;
      total.value = res.total;
    } finally {
      loading.value = false;
    }
  };

  const changePage = (p: number) => {
    page.value = p;
    refresh();
  };

  const changeSize = (s: number) => {
    size.value = s;
    page.value = 1;
    refresh();
  };

  const changeSort = (s: string) => {
    sort.value = s;
    refresh();
  };

  return reactive({
    items,
    total,
    loading,
    page,
    size,
    sort,
    refresh,
    changePage,
    changeSize,
    changeSort,
  });
}
