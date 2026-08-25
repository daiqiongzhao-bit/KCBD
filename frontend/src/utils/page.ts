/**
 * 全系统统一分页规格：
 * 100条/页、200条/页、1000条/页、2000条/页、全部数据（size=0 表示不分页查全部）
 * el-pagination 的 page-sizes 支持 { value, label } 对象数组（Element Plus ≥ 2.2）。
 * 类型断言为 any：Element Plus 的 TS 类型定义仅收 number[]，但运行时支持对象数组。
 */
export const PAGE_SIZE_OPTIONS: any[] = [
  { value: 100, label: '100条/页' },
  { value: 200, label: '200条/页' },
  { value: 1000, label: '1000条/页' },
  { value: 2000, label: '2000条/页' },
  { value: 0, label: '全部数据' },
];

/** 兼容旧代码的纯数字数组（对象数组不可用时回退）。 */
export const PAGE_SIZES = [100, 200, 1000, 2000, 0];

/**
 * 发送给后端的 size：0 表示全部（后端 normalizePage 识别为不分页）。
 * 非法值回退 100。
 */
export const normalizeSize = (size: number): number =>
  size === 0 || [100, 200, 1000, 2000].includes(size) ? size : 100;
