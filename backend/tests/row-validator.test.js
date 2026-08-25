/**
 * QA 单元测试：导入逐行校验链（R-P0-05：字段完整性 → 类型 → SKU 格式 → 仓库枚举）。
 * 直接 require dist 编译产物，不依赖数据库。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { RowValidator } = require('../dist/modules/upload/validation/row-validator.js');

test('EOP 校验：合法行进入 valid，非法 SKU 给出行号+字段+原因', () => {
  const rows = [
    { 'SKU编码': 'SKU001', '名称': 'A', '仓库': '正常', '总库存': '100', '实际库存': '100', '退货': '0' },
    { 'SKU编码': 'BAD@SKU', '名称': 'B', '仓库': '正常', '总库存': '50', '实际库存': '50' },
  ];
  const mapping = {
    sku_code: 'SKU编码',
    sku_name: '名称',
    warehouse: '仓库',
    stock_qty: '总库存',
    actual_qty: '实际库存',
    return_qty: '退货',
  };
  const { valid, issues } = RowValidator.validate(rows, mapping, 'eop');
  assert.equal(valid.length, 1);
  assert.equal(valid[0].sku_code, 'SKU001');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].row, 2);
  assert.equal(issues[0].field, 'sku_code');
  assert.match(issues[0].reason, /SKU 编码格式非法/);
});

test('EOP 校验：缺少必填字段映射 → 整表缺字段错误', () => {
  const rows = [{ 'SKU编码': 'SKU001', '名称': 'A' }];
  const mapping = { sku_code: 'SKU编码', sku_name: '名称' }; // 缺 warehouse/stock_qty/actual_qty
  const { valid, issues } = RowValidator.validate(rows, mapping, 'eop');
  assert.equal(valid.length, 0);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].field, 'warehouse');
  assert.match(issues[0].reason, /缺少字段/);
});

test('WMS 校验：可用库存由 stock-unsorted 推算（BR-03），数量非数字报错', () => {
  const rows = [
    { 'SKU编码': 'SKU001', '仓库': 'normal', '总库存': '100', '未分拣': '10' },
    { 'SKU编码': 'SKU002', '仓库': 'normal', '总库存': 'abc', '未分拣': '5' },
  ];
  const mapping = {
    sku_code: 'SKU编码',
    warehouse: '仓库',
    stock_qty: '总库存',
    unsorted_qty: '未分拣',
  };
  const { valid, issues } = RowValidator.validate(rows, mapping, 'wms');
  assert.equal(valid.length, 1);
  assert.equal(valid[0].stock_qty, 100);
  assert.equal(issues.length, 1);
  assert.match(issues[0].reason, /非数字/);
});

test('仓库类型非法 → issue（含行号与原始值）', () => {
  const rows = [{ 'SKU编码': 'SKU001', '仓库': '其他', '总库存': '10', '未分拣': '0' }];
  const mapping = { sku_code: 'SKU编码', warehouse: '仓库', stock_qty: '总库存', unsorted_qty: '未分拣' };
  const { valid, issues } = RowValidator.validate(rows, mapping, 'wms');
  assert.equal(valid.length, 0);
  assert.equal(issues[0].field, 'warehouse');
});

test('赠品校验：仅必填 sku_code，effective_date 可空', () => {
  const rows = [
    { 'SKU编码': 'GIFT1', '名称': '赠品A', '效期': '2026-12-31' },
    { 'SKU编码': 'GIFT2', '名称': '赠品B' },
  ];
  const mapping = { sku_code: 'SKU编码', sku_name: '名称', effective_date: '效期' };
  const { valid, issues } = RowValidator.validate(rows, mapping, 'gift');
  assert.equal(valid.length, 2);
  assert.equal(valid[0].effective_date, '2026-12-31');
  assert.equal(valid[1].effective_date, null);
  assert.equal(issues.length, 0);
});
