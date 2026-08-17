import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  NATIVE_CURRENCY_OPTIONS,
  normalizeNativeCurrency,
} from '../src/services/instrumentCurrency.js';
import {
  buildRecordCurrencyMetadataPayload,
  reconcileRecordCurrencies,
} from '../src/services/recordCurrencyReconciliation.js';

const RECORD = Object.freeze({
  id: 7,
  txn_date: '2026-08-14',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 15,
  price: 103.25,
  fee: 1.5,
  tax: 0.1,
  currency: null,
  note: 'private journal note',
  tag: 'Long-term',
});

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const options = (fetchImpl, overrides = {}) => ({
  getToken: () => 'token-a',
  refreshToken: async () => false,
  apiBaseUrl: 'https://api.example.test',
  fetchImpl,
  ...overrides,
});

test('currency normalization keeps GBp distinct from GBP while accepting ISO three-letter codes', () => {
  assert.equal(normalizeNativeCurrency('usd'), 'USD');
  assert.equal(normalizeNativeCurrency(' GBp '), 'GBp');
  assert.equal(normalizeNativeCurrency('gbp'), 'GBP');
  assert.equal(normalizeNativeCurrency('EURO'), '');
  assert.ok(NATIVE_CURRENCY_OPTIONS.includes('GBp'));
  assert.ok(NATIVE_CURRENCY_OPTIONS.includes('GBP'));
});

test('currency repair payload contains only record identity/economic guards plus currency', () => {
  assert.deepEqual(buildRecordCurrencyMetadataPayload(RECORD, 'USD'), {
    id: 7,
    txn_date: '2026-08-14',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 15,
    price: 103.25,
    fee: 1.5,
    tax: 0.1,
    currency: 'USD',
  });
  const payload = buildRecordCurrencyMetadataPayload(RECORD, 'USD');
  assert.equal(Object.hasOwn(payload, 'note'), false);
  assert.equal(Object.hasOwn(payload, 'tag'), false);
  assert.equal(Object.hasOwn(payload, 'event_source'), false);
});

test('currency repair rejects invalid local inputs before any network request', () => {
  assert.throws(() => buildRecordCurrencyMetadataPayload(RECORD, 'US D'), /Currency/);
  assert.throws(() => buildRecordCurrencyMetadataPayload({ ...RECORD, id: 0 }, 'USD'), /ID/);
  assert.throws(() => buildRecordCurrencyMetadataPayload({ ...RECORD, price: 'x' }, 'USD'), /price/);
});

test('batch repair writes with bounded concurrency and performs one authoritative readback', async () => {
  const records = Array.from({ length: 7 }, (_, index) => ({
    ...RECORD,
    id: index + 1,
    symbol: `TEST${index + 1}`,
  }));
  let active = 0;
  let maxActive = 0;
  let refreshCount = 0;
  let refreshed = [];
  const requests = [];

  const result = await reconcileRecordCurrencies(
    records.map(record => ({ record, currency: 'USD' })),
    options(async (url, init) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      requests.push({ url, body: JSON.parse(init.body) });
      await new Promise(resolve => setTimeout(resolve, 2));
      active -= 1;
      return response({ success: true, metadata_updated: true, record_id: JSON.parse(init.body).id });
    }, {
      refreshRecords: async () => {
        refreshCount += 1;
        refreshed = records.map(record => ({ ...record, currency: 'USD' }));
      },
      readRecords: () => refreshed,
      concurrency: 99,
    }),
  );

  assert.equal(requests.length, 7);
  assert.ok(maxActive <= 4);
  assert.equal(refreshCount, 1);
  assert.equal(result.readbackSucceeded, true);
  assert.equal(result.confirmed.length, 7);
  assert.equal(result.unconfirmed.length, 0);
  assert.ok(requests.every(request => request.url === 'https://api.example.test/api/records/metadata'));
  assert.ok(requests.every(request => Object.keys(request.body).sort().join(',') === 'currency,fee,id,price,qty,symbol,tax,txn_date,txn_type'));
});

test('ambiguous PUT is not called successful unless server readback proves the desired currency', async () => {
  let refreshCount = 0;
  let refreshed = [{ ...RECORD, currency: 'USD' }];
  const confirmed = await reconcileRecordCurrencies(
    [{ record: RECORD, currency: 'USD' }],
    options(async () => { throw new Error('network lost after PUT'); }, {
      refreshRecords: async () => { refreshCount += 1; },
      readRecords: () => refreshed,
    }),
  );
  assert.equal(refreshCount, 1);
  assert.equal(confirmed.confirmed.length, 1);
  assert.equal(confirmed.unconfirmed.length, 0);

  refreshed = [{ ...RECORD, currency: null }];
  const unconfirmed = await reconcileRecordCurrencies(
    [{ record: RECORD, currency: 'USD' }],
    options(async () => { throw new Error('network lost after PUT'); }, {
      refreshRecords: async () => { refreshCount += 1; },
      readRecords: () => refreshed,
    }),
  );
  assert.equal(unconfirmed.confirmed.length, 0);
  assert.equal(unconfirmed.unconfirmed.length, 1);
  assert.equal(unconfirmed.unconfirmed[0].error.outcomeAmbiguous, true);
});

test('failed readback never promotes an attempted write to confirmed state', async () => {
  const result = await reconcileRecordCurrencies(
    [{ record: RECORD, currency: 'USD' }],
    options(async () => response({ success: true, metadata_updated: true, record_id: 7 }), {
      refreshRecords: async () => { throw new Error('readback unavailable'); },
      readRecords: () => [{ ...RECORD, currency: 'USD' }],
    }),
  );
  assert.equal(result.readbackSucceeded, false);
  assert.equal(result.confirmed.length, 0);
  assert.equal(result.unconfirmed.length, 1);
});

test('reconciliation UI defaults to zero selection and never performs direct record API fetches', async () => {
  const source = await readFile(new URL('../src/components/RecordCurrencyReconciliation.vue', import.meta.url), 'utf8');
  assert.match(source, /const selectedIds = ref\(\[\]\)/);
  assert.match(source, /建議值只由 Symbol 市場後綴推測，不會自動寫入/);
  assert.match(source, /reconcileRecordCurrencies\(/);
  assert.doesNotMatch(source, /\/api\/records/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.match(source, /不會重算持倉或啟用現金 NAV/);
});

test('TradeForm persists explicit currency only for new entries and keeps legacy edit repair out of full PUT', async () => {
  const source = await readFile(new URL('../src/components/TradeForm.vue', import.meta.url), 'utf8');
  assert.match(source, /v-model="form\.currency"/);
  assert.match(source, /:disabled="isEditing"/);
  assert.match(source, /currency:\s*''/);
  assert.match(source, /delete payload\.currency/);
  assert.match(source, /normalizeNativeCurrency\(form\.currency\)/);
  assert.match(source, /歷史交易的缺失幣別請在「交易紀錄」中的現金帳本準備區確認/);
});

test('RecordList uses stored currency presentation authority and fails closed on stored-vs-symbol mismatch for TWD valuation', async () => {
  const source = await readFile(new URL('../src/components/RecordList.vue', import.meta.url), 'utf8');
  assert.match(source, /getRecordDisplayCurrency/);
  assert.match(source, /getStoredRecordCurrency/);
  assert.match(source, /storedCurrency && storedCurrency !== detectedCurrency/);
  assert.match(source, /<RecordCurrencyReconciliation\s*\/>/);
});