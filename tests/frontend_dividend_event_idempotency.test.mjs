import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildDividendEventIdempotencyKey,
  buildDividendEventKey,
  isDividendEventIdempotencyKey,
  matchesDividendEventIdempotencyKey,
  normalizeDividendEventIdentity,
} from '../shared/dividendEventIdentity.js';
import {
  beginRecordCreateIntent,
  withRecordCreateIdempotencyKey,
} from '../src/services/recordCreateIntent.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

const EVENT = Object.freeze({ symbol: ' nvda ', date: '2026-08-15' });
const RECORD = Object.freeze({
  txn_date: '2026-08-15',
  symbol: 'NVDA',
  txn_type: 'DIV',
  qty: 1,
  price: 12.34,
  fee: 0,
  tax: 0,
  tag: 'Auto-Dividend',
  note: '稅金:USD 2.00',
});

test('dividend event identity is normalized, versioned, deterministic, and event-sensitive', async () => {
  assert.deepEqual(normalizeDividendEventIdentity(EVENT), {
    version: 1,
    symbol: 'NVDA',
    date: '2026-08-15',
  });
  assert.equal(buildDividendEventKey(EVENT), 'NVDA_2026-08-15');

  const first = await buildDividendEventIdempotencyKey(EVENT);
  const second = await buildDividendEventIdempotencyKey({ symbol: 'NVDA', date: '2026-08-15' });
  const otherDate = await buildDividendEventIdempotencyKey({ symbol: 'NVDA', date: '2026-08-16' });
  const otherSymbol = await buildDividendEventIdempotencyKey({ symbol: 'AMD', date: '2026-08-15' });

  assert.match(first, /^dividend\.v1\.[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, otherDate);
  assert.notEqual(first, otherSymbol);
  assert.equal(isDividendEventIdempotencyKey(first), true);
  assert.equal(await matchesDividendEventIdempotencyKey(first, EVENT), true);
  assert.equal(await matchesDividendEventIdempotencyKey(first, { symbol: 'AMD', date: '2026-08-15' }), false);
});

test('invalid dividend event identities fail closed before a deterministic create key exists', async () => {
  assert.equal(normalizeDividendEventIdentity({ symbol: '', date: '2026-08-15' }), null);
  assert.equal(normalizeDividendEventIdentity({ symbol: 'NVDA', date: '2026-02-30' }), null);
  assert.equal(normalizeDividendEventIdentity({ symbol: 'BAD SYMBOL', date: '2026-08-15' }), null);
  await assert.rejects(
    buildDividendEventIdempotencyKey({ symbol: 'NVDA', date: '2026-02-30' }),
    /identity is invalid/,
  );
});

test('explicit dividend create identity is carried outside the JSON payload and survives durable intent creation', async () => {
  const storage = new MemoryStorage();
  const key = await buildDividendEventIdempotencyKey(EVENT);
  const decorated = withRecordCreateIdempotencyKey(RECORD, key);

  assert.equal(JSON.stringify(decorated), JSON.stringify(RECORD));
  assert.deepEqual(Object.keys(decorated), Object.keys(RECORD));

  let opaqueCall = 0;
  const intent = beginRecordCreateIntent(storage, 'User@Example.com', decorated, {
    now: 1_000,
    createOpaqueId: () => {
      opaqueCall += 1;
      return opaqueCall === 1
        ? 'barrier.0123456789abcdef'
        : 'random.0123456789abcdef';
    },
  });

  assert.equal(intent.idempotencyKey, key);
  assert.equal(intent.body, JSON.stringify(RECORD));
  assert.equal(opaqueCall, 1, 'an explicit key must not consume a second random ID');
});

test('ordinary record creates keep their existing random per-intent identity', () => {
  const storage = new MemoryStorage();
  const ids = ['barrier.0123456789abcdef', 'record.0123456789abcdef'];
  let call = 0;
  const intent = beginRecordCreateIntent(storage, 'user@example.com', RECORD, {
    now: 2_000,
    createOpaqueId: () => ids[call++],
  });
  assert.equal(intent.idempotencyKey, ids[1]);
  assert.equal(call, 2);
});

test('DividendManager binds deterministic identity only to the existing durable addRecord lifecycle', async () => {
  const source = await readFile(new URL('../src/components/DividendManager.vue', import.meta.url), 'utf8');
  assert.match(source, /buildDividendEventIdempotencyKey/);
  assert.match(source, /withRecordCreateIdempotencyKey/);
  assert.match(source, /store\.addRecord\(record, \{ returnOutcome: true \}\)/);
  assert.match(source, /DIVIDEND_EVENT_CONFLICT/);
  assert.match(source, /await store\.fetchRecords\(\)/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});
