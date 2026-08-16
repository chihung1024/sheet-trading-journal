import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createIbkrRecord, __test as recordCreateTest } from '../src/services/ibkrRecordCreate.js';
import { parseIbkrTradeCsv } from '../src/services/ibkrTradeImport.js';
import { runIbkrTradeImportBatch } from '../src/services/ibkrTradeImportBatch.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}

const HEADER = 'AccountID,AssetClass,Symbol,BuySell,Quantity,TradePrice,IBCommission,Taxes,CurrencyPrimary,TradeDate,IBOrderID,TradeID,DateTime,LevelOfDetail,DataDiscriminator';
const row = ({ account = 'U123', symbol = 'NVDA', side = 'BUY', qty = '1', price = '100', commission = '-0.5', taxes = '0', currency = 'USD', date = '2026-08-14', order = '487287953', trade = 'T1', dateTime = '20260814;100000' } = {}) => [
  account, 'STK', symbol, side, qty, price, commission, taxes, currency, date,
  order, trade, dateTime, 'EXECUTION', 'EXECUTION',
].join(',');

const ENTRY = Object.freeze({
  idempotencyKey: 'IBKR~ORDER~20260814~U123~487287953~NVDA~BUY',
  record: Object.freeze({
    txn_date: '2026-08-14', symbol: 'NVDA', txn_type: 'BUY', qty: 1, price: 100,
    fee: 0.5, tax: 0, tag: '', note: 'source=IBKR; order_id=487287953',
  }),
  metadata: Object.freeze({
    currency: 'USD',
    executed_at: '2026-08-14T10:00:00-04:00',
    execution_sequence: 'IBKR-ORDER:487287953',
    event_source: 'IBKR',
  }),
});

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const writerOptions = (storage, fetchImpl) => ({
  storage,
  owner: 'user@example.com',
  getToken: () => 'token-a',
  refreshToken: async () => false,
  apiBaseUrl: 'https://api.example.test',
  fetchImpl,
});

test('IBKR parser captures privacy-safe metadata while timezone-less DateTime stays non-authoritative', () => {
  const parsed = parseIbkrTradeCsv([HEADER, row()].join('\n'));
  assert.equal(parsed.entries.length, 1);
  const entry = parsed.entries[0];
  assert.deepEqual(entry.metadata, {
    currency: 'USD',
    execution_sequence: 'IBKR-ORDER:487287953',
    event_source: 'IBKR',
  });
  assert.equal(Object.hasOwn(entry.metadata, 'executed_at'), false);
  assert.doesNotMatch(JSON.stringify(entry.metadata), /U123/);
  assert.equal(Object.hasOwn(entry.record, 'currency'), false);
  assert.equal(Object.hasOwn(entry.record, 'event_source'), false);
});

test('genuine offset-aware single-fill timestamps are preserved without inventing a timezone', () => {
  const iso = parseIbkrTradeCsv([HEADER, row({ dateTime: '2026-08-14T10:00:00-04:00' })].join('\n'));
  assert.equal(iso.entries[0].metadata.executed_at, '2026-08-14T10:00:00-04:00');
  const compact = parseIbkrTradeCsv([HEADER, row({ dateTime: '20260814;100000-04:00' })].join('\n'));
  assert.equal(compact.entries[0].metadata.executed_at, '2026-08-14T10:00:00-04:00');
});

test('aggregated fills do not invent one executed_at when authoritative fill times differ', () => {
  const parsed = parseIbkrTradeCsv([
    HEADER,
    row({ trade: 'T1', qty: '1', price: '100', dateTime: '2026-08-14T10:00:00-04:00' }),
    row({ trade: 'T2', qty: '2', price: '101', dateTime: '2026-08-14T10:00:01-04:00' }),
  ].join('\n'));
  assert.equal(parsed.entries.length, 1);
  assert.equal(Object.hasOwn(parsed.entries[0].metadata, 'executed_at'), false);
});

test('metadata enrichment follows the byte-compatible legacy POST and uses record id plus economic guard', async () => {
  const storage = new MemoryStorage();
  const requests = [];
  const outcome = await createIbkrRecord(ENTRY, writerOptions(storage, async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith('/api/records/metadata')) return response({ success: true, metadata_updated: true, record_id: 99 });
    return response({ success: true, deduplicated: false, record_id: 99 });
  }));
  assert.equal(outcome.committed, true);
  assert.equal(outcome.metadataUpdated, true);
  assert.equal(outcome.metadataEnrichmentError, null);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.example.test/api/records');
  assert.equal(requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].init.body), { ...ENTRY.record, note: '' });
  assert.equal(requests[0].init.headers['Idempotency-Key'], await recordCreateTest.hashImportIdentity(ENTRY.idempotencyKey));
  assert.equal(requests[1].url, 'https://api.example.test/api/records/metadata');
  assert.equal(requests[1].init.method, 'PUT');
  const metadataBody = JSON.parse(requests[1].init.body);
  assert.deepEqual(metadataBody, {
    id: 99,
    txn_date: '2026-08-14', symbol: 'NVDA', txn_type: 'BUY', qty: 1, price: 100,
    fee: 0.5, tax: 0,
    currency: 'USD', executed_at: '2026-08-14T10:00:00-04:00',
    execution_sequence: 'IBKR-ORDER:487287953', event_source: 'IBKR',
  });
  assert.equal(Object.hasOwn(metadataBody, 'note'), false);
  assert.equal(Object.hasOwn(metadataBody, 'tag'), false);
});

test('replayed create keeps the same legacy POST key and idempotently replays metadata enrichment', async () => {
  const storage = new MemoryStorage();
  const requests = [];
  const outcome = await createIbkrRecord(ENTRY, writerOptions(storage, async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith('/api/records/metadata')) return response({ success: true, metadata_updated: false, record_id: 99 });
    return response({ success: true, deduplicated: true, record_id: 99 });
  }));
  assert.equal(outcome.deduplicated, true);
  assert.equal(outcome.metadataUpdated, false);
  assert.equal(outcome.metadataEnrichmentError, null);
  assert.equal(requests[0].init.headers['Idempotency-Key'], await recordCreateTest.hashImportIdentity(ENTRY.idempotencyKey));
});

test('metadata conflict after confirmed create remains a warning and never falsifies transaction truth', async () => {
  const storage = new MemoryStorage();
  const outcome = await createIbkrRecord(ENTRY, writerOptions(storage, async (url) => {
    if (url.endsWith('/api/records/metadata')) {
      return response({ success: false, error: 'metadata conflict', error_meta: { code: 'METADATA_CONFLICT' } }, 409);
    }
    return response({ success: true, deduplicated: false, record_id: 99 });
  }));
  assert.equal(outcome.committed, true);
  assert.equal(outcome.outcomeAmbiguous, false);
  assert.equal(outcome.metadataUpdated, false);
  assert.equal(outcome.metadataEnrichmentError?.status, 409);
  assert.equal(outcome.metadataOutcomeAmbiguous, false);
});

test('ambiguous metadata network loss after confirmed replay asks batch for readback only', async () => {
  const storage = new MemoryStorage();
  const outcome = await createIbkrRecord(ENTRY, writerOptions(storage, async (url) => {
    if (url.endsWith('/api/records/metadata')) throw new Error('network lost after PUT');
    return response({ success: true, deduplicated: true, record_id: 99 });
  }));
  assert.equal(outcome.committed, true);
  assert.equal(outcome.metadataOutcomeAmbiguous, true);
  let refresh = 0;
  let update = 0;
  const result = await runIbkrTradeImportBatch([ENTRY], {
    createRecord: async () => outcome,
    refreshRecords: async () => { refresh += 1; },
    requestUpdate: async () => { update += 1; },
  });
  assert.equal(result.status, 'replayed_with_sync_warning');
  assert.equal(result.sync.metadataWarnings.length, 1);
  assert.equal(refresh, 1);
  assert.equal(update, 0);
});

test('metadata-only success after replay refreshes detail state without requesting portfolio calculation', async () => {
  let refresh = 0;
  let update = 0;
  const result = await runIbkrTradeImportBatch([ENTRY], {
    createRecord: async () => ({ committed: true, deduplicated: true, metadataUpdated: true, metadataEnrichmentError: null, metadataOutcomeAmbiguous: false }),
    refreshRecords: async () => { refresh += 1; },
    requestUpdate: async () => { update += 1; },
  });
  assert.equal(result.status, 'replayed');
  assert.equal(result.metadataUpdated, 1);
  assert.equal(refresh, 1);
  assert.equal(update, 0);
});

test('definite metadata warning does not trigger calculation or unnecessary readback', async () => {
  let refresh = 0;
  let update = 0;
  const conflict = Object.assign(new Error('conflict'), { outcomeAmbiguous: false, status: 409 });
  const result = await runIbkrTradeImportBatch([ENTRY], {
    createRecord: async () => ({ committed: true, deduplicated: true, metadataUpdated: false, metadataEnrichmentError: conflict, metadataOutcomeAmbiguous: false }),
    refreshRecords: async () => { refresh += 1; },
    requestUpdate: async () => { update += 1; },
  });
  assert.equal(result.status, 'replayed_with_sync_warning');
  assert.equal(result.sync.metadataWarnings.length, 1);
  assert.equal(refresh, 0);
  assert.equal(update, 0);
});

test('IBKR UI surfaces metadata outcome separately and still has no direct record API access', async () => {
  const component = await readFile(new URL('../src/components/IbkrTradeImport.vue', import.meta.url), 'utf8');
  assert.match(component, /成交來源資訊已補充/);
  assert.match(component, /交易本身已保存或確認存在/);
  assert.match(component, /來源提醒/);
  assert.doesNotMatch(component, /\/api\/records/);
  assert.doesNotMatch(component, /\bfetch\s*\(/);
});
