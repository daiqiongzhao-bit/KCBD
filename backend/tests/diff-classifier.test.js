/**
 * QA 单元测试：差异分类器（BR-10/11/12/13）
 * 直接 require dist 编译产物，不依赖数据库。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyDiff } = require('../dist/modules/reconcile/engine/diff-classifier.js');

const TOL = 0.005; // 默认容差 0.5%

test('BR-13 容差内记为一致（diff 与 actual 都在容差内）', () => {
  const r = classifyDiff({
    diffValue: 5,
    diffValueActual: 3,
    eopStock: 1000,
    eopActual: 1000,
    wmsAvailable: 997,
    wmsUnsorted: 0,
    tolerance: TOL,
  });
  assert.equal(r.status, 'match');
  assert.equal(r.diffType, 'none');
});

test('BR-13 超出容差 → 差异', () => {
  const r = classifyDiff({
    diffValue: 200,
    diffValueActual: 150,
    eopStock: 1000,
    eopActual: 1000,
    wmsAvailable: 850,
    wmsUnsorted: 0,
    tolerance: TOL,
  });
  assert.equal(r.status, 'diff');
  assert.notEqual(r.diffType, 'none');
});

test('BR-10 eop_actual > wms_available → 类型 A（WMS 漏入库）', () => {
  const r = classifyDiff({
    diffValue: 100,
    diffValueActual: 80,
    eopStock: 1000,
    eopActual: 1000,
    wmsAvailable: 920,
    wmsUnsorted: 0,
    tolerance: TOL,
  });
  assert.equal(r.status, 'diff');
  assert.equal(r.diffType, 'A');
  assert.match(r.possibleCause, /漏入库/);
});

test('BR-11 eop_actual < wms_available → 类型 B（WMS 未出库）', () => {
  const r = classifyDiff({
    diffValue: -120,
    diffValueActual: -110,
    eopStock: 1000,
    eopActual: 880,
    wmsAvailable: 990,
    wmsUnsorted: 0,
    tolerance: TOL,
  });
  assert.equal(r.status, 'diff');
  assert.equal(r.diffType, 'B');
  assert.match(r.possibleCause, /未出库/);
});

test('BR-12 有未分拣且 EOP 已扣减 → 时间差差异', () => {
  const r = classifyDiff({
    diffValue: -50,
    diffValueActual: -30,
    eopStock: 1000,
    eopActual: 970,
    wmsAvailable: 1000,
    wmsUnsorted: 50,
    tolerance: TOL,
  });
  assert.equal(r.status, 'time_diff');
  assert.equal(r.diffType, 'time_diff');
});

test('边界：eopStock=0 且无差异 → match（除零保护）', () => {
  const r = classifyDiff({
    diffValue: 0,
    diffValueActual: 0,
    eopStock: 0,
    eopActual: 0,
    wmsAvailable: 0,
    wmsUnsorted: 0,
    tolerance: TOL,
  });
  assert.equal(r.status, 'match');
});

test('边界：仅 WMS 有库存（eop 缺失）→ 记为差异 B', () => {
  const r = classifyDiff({
    diffValue: -10,
    diffValueActual: -10,
    eopStock: 0,
    eopActual: 0,
    wmsAvailable: 10,
    wmsUnsorted: 0,
    tolerance: TOL,
  });
  assert.equal(r.status, 'diff');
  assert.equal(r.diffType, 'B');
});

test('tolerance=0 时任何非零差异都记为差异', () => {
  const r = classifyDiff({
    diffValue: 1,
    diffValueActual: 0,
    eopStock: 1000,
    eopActual: 1000,
    wmsAvailable: 1000,
    wmsUnsorted: 0,
    tolerance: 0,
  });
  assert.equal(r.status, 'diff');
});
