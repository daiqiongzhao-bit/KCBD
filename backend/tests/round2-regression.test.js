/**
 * QA 第二轮回归：针对工程师修复点的专项用例（零 DB，mock 依赖）。
 * - P0-1  row-validator gift 源跳过 warehouse 校验
 * - P0-3  reconcile.findAll 排序白名单（合法字段生效 / 非法字段回落默认）
 * - P1-4  notify.createIfAbsent 幂等去重
 * - P1-6  reconcile 对 warehouse 角色脱敏，其他角色数据完整
 * - P2-7  parseEffectiveDate 本地时区修复
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { RowValidator } = require('../dist/modules/upload/validation/row-validator.js');
const { parseEffectiveDate } = require('../dist/modules/upload/validation/rules.js');
const { NotifyService } = require('../dist/modules/notify/notify.service.js');
const { ReconcileService } = require('../dist/modules/reconcile/reconcile.service.js');

/* ---------- P0-1：gift 源跳过 warehouse 校验 ---------- */
test('P0-1 gift 行不再因缺少 warehouse 映射被拒', () => {
  const rows = [
    { 'SKU编码': 'GIFT1', '名称': '赠品A', '效期': '2026-12-31' },
    { 'SKU编码': 'GIFT2', '名称': '赠品B' },
  ];
  const mapping = { sku_code: 'SKU编码', sku_name: '名称', effective_date: '效期' };
  const { valid, issues } = RowValidator.validate(rows, mapping, 'gift');
  assert.equal(valid.length, 2);
  assert.equal(issues.length, 0);
  assert.equal(valid[0].effective_date, '2026-12-31');
  assert.equal(valid[1].effective_date, null);
});

/* ---------- P2-7：parseEffectiveDate 本地时区 ---------- */
test('P2-7 parseEffectiveDate 使用本地时区，非 ISO 日期不再前移一天', () => {
  assert.equal(parseEffectiveDate('2026/12/31'), '2026-12-31');
  assert.equal(parseEffectiveDate('2026-01-01'), '2026-01-01');
  const d = new Date(2026, 11, 31); // 本地 2026-12-31
  assert.equal(parseEffectiveDate(d), '2026-12-31');
  assert.equal(parseEffectiveDate(''), null);
});

/* ---------- P1-4：notify.createIfAbsent 幂等去重 ---------- */
function makeNotifyRepo() {
  const rows = [];
  return {
    rows,
    findOne: async ({ where }) =>
      rows.find((r) =>
        Object.entries(where).every(([k, v]) => r[k] === v),
      ) ?? null,
    create: (d) => ({ ...d }),
    save: async (d) => { rows.push(d); return d; },
  };
}

test('P1-4 createIfAbsent 按 type+title+message 去重（无 relatedId）', async () => {
  const repo = makeNotifyRepo();
  const svc = new NotifyService(repo);
  const input = { type: 'diff', title: '库存差异：SKU001', message: '差异值 10' };
  const first = await svc.createIfAbsent(input);
  assert.ok(first !== null);
  const second = await svc.createIfAbsent(input);
  assert.equal(second, null);
  assert.equal(repo.rows.length, 1); // 仅创建 1 条
});

test('P1-4 createIfAbsent 按 type+related_id 去重（有 relatedId）', async () => {
  const repo = makeNotifyRepo();
  const svc = new NotifyService(repo);
  await svc.createIfAbsent({ type: 'diff', title: 't', message: 'm1', relatedId: 7 });
  const dup = await svc.createIfAbsent({ type: 'diff', title: 't', message: 'm2', relatedId: 7 });
  assert.equal(dup, null); // 同一 related_id 视为已存在
  assert.equal(repo.rows.length, 1);
});

/* ---------- P1-6：warehouse 脱敏 + 其他角色完整 ---------- */
function makeReconcileQb(rows) {
  const qb = {
    _order: null,
    where() { return qb; },
    andWhere() { return qb; },
    orderBy(field, dir) { qb._order = [field, dir]; return qb; },
    skip() { return qb; },
    take() { return qb; },
    async getManyAndCount() { return [rows, rows.length]; },
  };
  return qb;
}

function makeReconcileService(rows) {
  const repo = {
    createQueryBuilder: () => makeReconcileQb(rows),
    findOne: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
  };
  return new ReconcileService(repo, {}, {}, {}, {}, {});
}

const sampleRows = [
  {
    id: 1,
    sku_code: 'SKU001',
    warehouse: 'normal',
    diff_value: 5,
    diff_value_actual: 3,
    diff_rate: 0.05,
    status: 'diff',
  },
];

test('P1-6 findAll：warehouse 角色 diff_value/diff_rate 置 null，操作口径保留', async () => {
  const svc = makeReconcileService(sampleRows);
  const { items } = await svc.findAll({}, 'warehouse');
  assert.equal(items[0].diff_value, null);
  assert.equal(items[0].diff_value_actual, null);
  assert.equal(items[0].diff_rate, null);
  assert.equal(items[0].sku_code, 'SKU001'); // 非财务口径保留
  assert.equal(items[0].status, 'diff');
});

test('P1-6 findAll：admin/finance 角色数据完整（不脱敏）', async () => {
  const svc = makeReconcileService(sampleRows);
  for (const role of ['admin', 'finance', 'manager', undefined]) {
    const { items } = await svc.findAll({}, role);
    assert.equal(items[0].diff_value, 5, `role=${role} 不应脱敏`);
    assert.equal(items[0].diff_rate, 0.05, `role=${role} 不应脱敏`);
  }
});

test('P1-6 findOne：warehouse 脱敏，其他角色完整', async () => {
  const svc = makeReconcileService(sampleRows);
  const masked = await svc.findOne(1, 'warehouse');
  assert.equal(masked.diff_value, null);
  const full = await svc.findOne(1, 'finance');
  assert.equal(full.diff_value, 5);
});

/* ---------- P0-3：排序白名单 ---------- */
test('P0-3 合法排序字段生效，方向仅 ASC/DESC', async () => {
  const svc = makeReconcileService(sampleRows);
  const qb = makeReconcileQb(sampleRows);
  const repo = { createQueryBuilder: () => qb };
  const svc2 = new ReconcileService(repo, {}, {}, {}, {}, {});
  await svc2.findAll({ sort: 'diff_value,DESC' });
  assert.deepEqual(qb._order, ['r.diff_value', 'DESC']);
});

test('P0-3 非法排序字段回落 reconciled_at DESC（防注入）', async () => {
  const qb = makeReconcileQb(sampleRows);
  const repo = { createQueryBuilder: () => qb };
  const svc = new ReconcileService(repo, {}, {}, {}, {}, {});
  await svc.findAll({ sort: 'id; DROP TABLE users--,ASC' });
  assert.deepEqual(qb._order, ['r.reconciled_at', 'DESC']);
});
