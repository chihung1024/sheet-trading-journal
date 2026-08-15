import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRADE_FORM_PATH = path.join(ROOT, 'src', 'components', 'TradeForm.vue');
const source = fs.readFileSync(TRADE_FORM_PATH, 'utf8');

test('transaction entry language records trades instead of implying broker order submission', () => {
  assert.match(source, /case 'BUY': return '記錄買進'/);
  assert.match(source, /case 'SELL': return '記錄賣出'/);
  assert.match(source, /case 'DIV': return '記錄股息'/);
  assert.doesNotMatch(source, /送出買單|送出賣單/);
  assert.match(source, /記錄實際成交，不會向券商送出訂單/);
});

test('execution amount is explicitly non-fee-tax and preserves price authority when both inputs are supplied', () => {
  assert.match(source, /成交金額（未含費稅，\{\{ transactionCurrency \}\}）/);
  assert.match(source, /可填成交單價或成交金額其中之一；若兩者都填，以成交單價記錄交易。/);
  const buildStart = source.indexOf('const buildRecordPayload = () => {');
  const buildEnd = source.indexOf('const submit = async () => {', buildStart);
  const buildBlock = source.slice(buildStart, buildEnd);
  assert.ok(buildStart >= 0 && buildEnd > buildStart);
  assert.match(buildBlock, /if \(payload\.price <= 0 && payload\.total_amount > 0\)/);
  assert.match(buildBlock, /payload\.price = payload\.total_amount \/ payload\.qty/);
  assert.match(buildBlock, /else if \(payload\.total_amount <= 0 && payload\.price > 0\)/);
});

test('execution fields now precede strategy tags in the DOM flow', () => {
  const symbolAt = source.indexOf('交易標的 Symbol');
  const dateAt = source.indexOf('日期 Date');
  const priceAt = source.indexOf('成交單價');
  const qtyAt = source.indexOf('股數 Shares');
  const feeAt = source.indexOf('手續費 Fee');
  const amountAt = source.indexOf('成交金額（未含費稅');
  const tagsAt = source.indexOf('策略群組 (Tags)');
  const noteAt = source.indexOf('id="trade-note"');
  assert.ok(symbolAt >= 0 && dateAt > symbolAt && priceAt > dateAt && qtyAt > priceAt);
  assert.ok(feeAt > qtyAt && amountAt > feeAt && tagsAt > amountAt && noteAt > tagsAt);
});

test('required-entry validation is field-specific without changing the existing acceptance predicates', () => {
  assert.match(source, /symbol: !form\.symbol \? '請輸入交易標的 Symbol' : ''/);
  assert.match(source, /qty: !form\.qty \? '請輸入股數' : ''/);
  assert.match(source, /\(!form\.price && !form\.total_amount\) \? '請輸入成交單價或成交金額' : ''/);
  assert.match(source, /selectedSellGroups\.value\.length === 0/);
  assert.doesNotMatch(source, /請填寫完整資料/);
  assert.match(source, /addToast\(firstValidationError\.value, 'error'\)/);
});

test('mobile keeps qty prominent and fee/tax compact with a narrow-screen fallback', () => {
  assert.match(source, /@media \(max-width: 768px\)[\s\S]*?\.triple-input \{ grid-template-columns: 1fr 1fr; gap: 16px; \}/);
  assert.match(source, /\.triple-input \.input-with-label:first-child \{ grid-column: 1 \/ -1; \}/);
  assert.match(source, /@media \(max-width: 380px\)[\s\S]*?\.triple-input \{ grid-template-columns: 1fr; \}/);
});
