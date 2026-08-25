/**
 * QA 单元测试：导入校验规则（R-P0-05：类型/SKU 格式/仓库枚举/日期）与 NumericTransformer。
 * 直接 require dist 编译产物，不依赖数据库。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  toNumber,
  normalizeWarehouse,
  isValidSku,
  parseEffectiveDate,
} = require('../dist/modules/upload/validation/rules.js');

const { NumericTransformer } = require('../dist/common/transformers/numeric.transformer.js');

test('toNumber：数字字符串与千分位', () => {
  assert.equal(toNumber('123'), 123);
  assert.equal(toNumber('1,234.5'), 1234.5);
});

test('toNumber：空/非数字 → NaN', () => {
  assert.ok(Number.isNaN(toNumber('')));
  assert.ok(Number.isNaN(toNumber(null)));
  assert.ok(Number.isNaN(toNumber(undefined)));
  assert.ok(Number.isNaN(toNumber('abc')));
});

test('normalizeWarehouse：兼容英文与中文', () => {
  assert.equal(normalizeWarehouse('normal'), 'normal');
  assert.equal(normalizeWarehouse(' 正常 '), 'normal');
  assert.equal(normalizeWarehouse('expired'), 'expired');
  assert.equal(normalizeWarehouse('临期'), 'expired');
  assert.equal(normalizeWarehouse('未知'), null);
  assert.equal(normalizeWarehouse(''), null);
});

test('isValidSku：合法格式与超长/非法字符', () => {
  assert.equal(isValidSku('SKU-001'), true);
  assert.equal(isValidSku('sku_001'), true);
  assert.equal(isValidSku('A'.repeat(64)), true);
  assert.equal(isValidSku('A'.repeat(65)), false);
  assert.equal(isValidSku('SKU@001'), false);
  assert.equal(isValidSku(''), false);
});

test('parseEffectiveDate：YYYY-MM-DD 与可解析日期', () => {
  assert.equal(parseEffectiveDate('2026-12-31'), '2026-12-31');
  assert.equal(parseEffectiveDate('2026/12/31'), '2026-12-31');
  assert.equal(parseEffectiveDate(''), null);
  assert.equal(parseEffectiveDate('not-a-date'), null);
});

test('NumericTransformer.to：null/undefined → null，数值 → number', () => {
  assert.equal(NumericTransformer.to(null), null);
  assert.equal(NumericTransformer.to(undefined), null);
  assert.equal(NumericTransformer.to('100.5'), 100.5);
  assert.equal(NumericTransformer.to(42), 42);
});

test('NumericTransformer.from：PG 字符串 → number，空串 → null', () => {
  assert.equal(NumericTransformer.from('123.45'), 123.45);
  assert.equal(NumericTransformer.from(123), 123);
  assert.equal(NumericTransformer.from(''), null);
  assert.equal(NumericTransformer.from(null), null);
});
