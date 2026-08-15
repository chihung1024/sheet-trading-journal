import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getHistoryDateRangeError,
  getRecordTags,
  hasLocalHistoryFilters,
  normalizeRecordDate,
  recordMatchesHistoryFilters,
} from '../src/services/recordHistoryPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const record = Object.freeze({
  id: 1,
  txn_date: '2026-08-15',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 2,
  price: 100,
  fee: 1,
  tax: 0,
  tag: 'AI; Growth,AI',
  note: '加碼核心部位',
});

test('strategy tags are trimmed, deduplicated, and preserve source order', () => {
  assert.deepEqual(getRecordTags(record), ['AI', 'Growth']);
  assert.deepEqual(getRecordTags({ tag: ' ; , ' }), []);
  assert.deepEqual(getRecordTags(null), []);
});

test('date-only normalization rejects impossible calendar dates without timezone conversion', () => {
  assert.equal(normalizeRecordDate('2026-08-15'), '2026-08-15');
  assert.equal(normalizeRecordDate('2026-02-29'), '');
  assert.equal(normalizeRecordDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeRecordDate('08/15/2026'), '');
});

test('history filtering composes query, type, inclusive date range, and current strategy group', () => {
  assert.equal(recordMatchesHistoryFilters(record, {
    query: '核心',
    type: 'BUY',
    dateFrom: '2026-08-15',
    dateTo: '2026-08-15',
    currentGroup: 'Growth',
  }), true);

  assert.equal(recordMatchesHistoryFilters(record, { query: 'ai' }), true);
  assert.equal(recordMatchesHistoryFilters(record, { query: 'nvda' }), true);
  assert.equal(recordMatchesHistoryFilters(record, { dateFrom: '2026-08-16' }), false);
  assert.equal(recordMatchesHistoryFilters(record, { dateTo: '2026-08-14' }), false);
  assert.equal(recordMatchesHistoryFilters(record, { type: 'SELL' }), false);
  assert.equal(recordMatchesHistoryFilters(record, { currentGroup: 'Income' }), false);
});

test('date-range validation is explicit and local filter state excludes global group scope', () => {
  assert.equal(getHistoryDateRangeError({ dateFrom: '2026-08-20', dateTo: '2026-08-10' }), '開始日期不可晚於結束日期');
  assert.equal(getHistoryDateRangeError({ dateFrom: '2026-02-29' }), '開始日期格式無效');
  assert.equal(getHistoryDateRangeError({ dateTo: '2026-13-01' }), '結束日期格式無效');
  assert.equal(getHistoryDateRangeError({ dateFrom: '2026-08-01', dateTo: '2026-08-31' }), '');

  assert.equal(hasLocalHistoryFilters({}), false);
  assert.equal(hasLocalHistoryFilters({ query: 'NVDA' }), true);
  assert.equal(hasLocalHistoryFilters({ type: 'DIV' }), true);
  assert.equal(hasLocalHistoryFilters({ dateFrom: '2026-08-01' }), true);
  assert.equal(hasLocalHistoryFilters({ currentGroup: 'Growth' }), false);
});

test('RecordList exposes strategy context and explicit date/filter state on desktop and mobile', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /代碼 \/ 策略/);
  assert.match(source, /v-model="dateFrom"/);
  assert.match(source, /v-model="dateTo"/);
  assert.match(source, /aria-label="開始日期"/);
  assert.match(source, /aria-label="結束日期"/);
  assert.match(source, /recordMatchesHistoryFilters\(r, historyFilters\.value\)/);
  assert.match(source, /getRecordTags\(r\)/);
  assert.match(source, /class="record-tags"/);
  assert.match(source, /class="record-tags mobile-tags"/);
  assert.match(source, /策略群組：\$\{store\.currentGroup\}/);
  assert.match(source, /clearLocalFilters/);
  assert.match(source, /顯示筆數/);
  assert.match(source, /顯示 \{\{ processedRecords\.length \}\} \/ \{\{ store\.records\.length \}\} 筆/);
  assert.doesNotMatch(source, /filterYear|availableYears/);
});

test('Phase 10.3A preserves authoritative valuation and mutation paths', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /resolveTransactionValuation\(store\.rawData, record\)/);
  assert.match(source, /store\.snapshotFreshness !== 'loaded'/);
  assert.match(source, /emit\('edit', record\)/);
  assert.match(source, /await store\.deleteRecord\(id\)/);
  assert.match(source, /<th>備註<\/th>/);
  assert.match(source, /colspan="8"/);
  assert.doesNotMatch(source, /fxRateMap|getFxRateByDate|Math\.abs\(r\.fee\)|Math\.abs\(r\.tax\)/);
});
