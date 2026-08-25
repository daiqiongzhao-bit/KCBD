/**
 * QA 单元测试：AlertConfigService 容差/阈值读取（BR-13 默认 0.5%、R-P1-03/R-P2-01 默认值）。
 * 使用 mock Repository，不连数据库。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { AlertConfigService } = require('../dist/modules/dashboard/alert-config.service.js');

/** 构造带内存 findOne/save 的 mock repo（save 语义：已存在对象则更新，否则新增）。 */
function makeRepo(seed = []) {
  const rows = [...seed];
  return {
    findOne: async ({ where }) => rows.find((r) => r.key === where.key && r.scope === where.scope) ?? null,
    create: (data) => data,
    save: async (data) => {
      const idx = rows.indexOf(data);
      if (idx >= 0) rows[idx] = data; // 更新
      else rows.push(data); // 新增
      return data;
    },
    _rows: rows,
  };
}

test('getNumber：未配置时返回默认容差 0.005（BR-13 推荐默认）', async () => {
  const svc = new AlertConfigService(makeRepo());
  assert.equal(await svc.getNumber('diff_rate_tolerance', 0.005), 0.005);
});

test('getNumber：配置存在时返回数值，非法值回退默认', async () => {
  const svc = new AlertConfigService(
    makeRepo([
      { key: 'diff_rate_tolerance', value: '0.02', scope: 'global' },
      { key: 'expiry_warn_days', value: 'abc', scope: 'global' },
    ]),
  );
  assert.equal(await svc.getNumber('diff_rate_tolerance', 0.005), 0.02);
  assert.equal(await svc.getNumber('expiry_warn_days', 90), 90); // 非法回退
});

test('getString：未配置回退默认；配置存在返回原值', async () => {
  const svc = new AlertConfigService(makeRepo());
  assert.equal(await svc.getString('notify_channel', 'inapp'), 'inapp');
  const svc2 = new AlertConfigService(makeRepo([{ key: 'notify_channel', value: 'email', scope: 'global' }]));
  assert.equal(await svc2.getString('notify_channel', 'inapp'), 'email');
});

test('set：不存在时创建，存在时更新', async () => {
  const repo = makeRepo();
  const svc = new AlertConfigService(repo);
  await svc.set('diff_rate_tolerance', '0.01');
  assert.equal(await svc.getNumber('diff_rate_tolerance', 0.005), 0.01);
  await svc.set('diff_rate_tolerance', '0.008');
  assert.equal(repo._rows.length, 1); // 更新而非新增
  assert.equal(await svc.getNumber('diff_rate_tolerance', 0.005), 0.008);
});
