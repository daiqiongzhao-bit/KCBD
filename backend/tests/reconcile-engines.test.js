/**
 * QA 单元测试：正常仓/临期仓对账引擎（BR-06/07/08/09）与赠品拆分（BR-14/15）
 * 使用内存对象构造 EopInventory/WmsInventory（仅需字段，不需要真实 DB）。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

// 注册 reflect-metadata，保证装饰器实体可加载
require('reflect-metadata');

const { reconcileNormalWarehouse } = require('../dist/modules/reconcile/engine/normal-warehouse.engine.js');
const { reconcileExpiredWarehouse } = require('../dist/modules/reconcile/engine/expired-warehouse.engine.js');
const { splitByGift } = require('../dist/modules/reconcile/engine/gift-split.engine.js');

const TOL = 0.005;

const eopRow = (sku, warehouse, stock, actual, ret = 0) => ({
  sku_code: sku, warehouse, stock_qty: stock, actual_qty: actual, return_qty: ret,
});
const wmsRow = (sku, warehouse, stock, available, unsorted) => ({
  sku_code: sku, warehouse, stock_qty: stock, available_qty: available, unsorted_qty: unsorted,
});

test('BR-06 正常仓总量等式：WMS(available+unsorted)==EOP(stock) 且容差内 → match', () => {
  // 依据 BR-02/BR-06/BR-07：EOP.stock(100)=actual(95)+return(5)；WMS.total(100)=available(95)+unsorted(5)
  const rows = reconcileNormalWarehouse({
    eopRows: [eopRow('SKU001', 'normal', 100, 95, 5)],
    wmsRows: [wmsRow('SKU001', 'normal', 100, 95, 5)],
    eopBatchId: 1,
    wmsBatchId: 2,
    tolerance: TOL,
    isGift: false,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'match');
  assert.equal(rows[0].diff_value, 0);
  assert.equal(rows[0].warehouse, 'normal');
});

test('BR-07 正常仓实际对齐：WMS(available)≈EOP(actual) 超容差 → 差异类型 A', () => {
  const rows = reconcileNormalWarehouse({
    eopRows: [eopRow('SKU002', 'normal', 100, 100, 0)],
    wmsRows: [wmsRow('SKU002', 'normal', 90, 90, 0)],
    eopBatchId: 1,
    wmsBatchId: 2,
    tolerance: TOL,
    isGift: false,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'diff');
  assert.equal(rows[0].diff_type, 'A');
  assert.equal(rows[0].diff_value, 10);
});

test('BR-12 未分拣存在且 EOP 已扣 → 时间差（time_diff）', () => {
  // 场景：EOP 已按销售确认扣减（actual=40），WMS 仍保留 available=50 + unsorted=10（销售单已生成未出库）
  const rows = reconcileNormalWarehouse({
    eopRows: [eopRow('SKU003', 'normal', 50, 40, 10)],
    wmsRows: [wmsRow('SKU003', 'normal', 60, 50, 10)],
    eopBatchId: 1,
    wmsBatchId: 2,
    tolerance: TOL,
    isGift: false,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'time_diff');
});

test('BR-08/09 临期仓引擎：结果仓库恒为 expired，逻辑同正常仓', () => {
  const rows = reconcileExpiredWarehouse({
    eopRows: [eopRow('SKU004', 'expired', 200, 200, 0)],
    wmsRows: [wmsRow('SKU004', 'expired', 200, 200, 0)],
    eopBatchId: 1,
    wmsBatchId: 2,
    tolerance: TOL,
    isGift: false,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].warehouse, 'expired');
  assert.equal(rows[0].status, 'match');
});

test('对账覆盖两系统全部 SKU（差集也产生结果行）', () => {
  const rows = reconcileNormalWarehouse({
    eopRows: [eopRow('EOP_ONLY', 'normal', 10, 10, 0)],
    wmsRows: [wmsRow('WMS_ONLY', 'normal', 5, 5, 0)],
    eopBatchId: 1,
    wmsBatchId: 2,
    tolerance: TOL,
    isGift: false,
  });
  assert.equal(rows.length, 2);
});

test('BR-14 赠品拆分：按 giftSet 拆分为赠品/非赠品子集', () => {
  const eops = [
    eopRow('GIFT1', 'normal', 10, 10, 0),
    eopRow('NORMAL1', 'normal', 20, 20, 0),
  ];
  const wmss = [
    wmsRow('GIFT1', 'normal', 10, 10, 0),
    wmsRow('NORMAL1', 'normal', 20, 20, 0),
  ];
  const r = splitByGift(eops, wmss, new Set(['GIFT1']));
  assert.equal(r.giftEop.length, 1);
  assert.equal(r.giftWms.length, 1);
  assert.equal(r.normalEop.length, 1);
  assert.equal(r.normalWms.length, 1);
  assert.equal(r.giftEop[0].sku_code, 'GIFT1');
  assert.equal(r.normalEop[0].sku_code, 'NORMAL1');
});

test('BR-15 临期仓出现赠品 → 即时告警（EOP/WMS 双方）', () => {
  const eops = [eopRow('GIFT_EXP', 'expired', 5, 5, 0)];
  const wmss = [wmsRow('GIFT_EXP', 'expired', 5, 5, 0)];
  const r = splitByGift(eops, wmss, new Set(['GIFT_EXP']));
  assert.equal(r.expiredGiftWarnings.length, 2);
  assert.ok(r.expiredGiftWarnings.every((w) => w.reason.includes('临期仓')));
});
