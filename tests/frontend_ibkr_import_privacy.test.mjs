import assert from 'node:assert/strict';
import test from 'node:test';

import { createIbkrRecord, __test } from '../src/services/ibkrRecordCreate.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}

const entry = Object.freeze({
  idempotencyKey: 'IBKR~ORDER~20260814~U1234567~487287953~NVDA~BUY',
  record: Object.freeze({
    txn_date: '2026-08-14',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 2,
    price: 100,
    fee: 1,
    tax: 0,
    tag: '',
    note: 'source=IBKR; account_id=U1234567; currency=USD; order_id=487287953',
  }),
});

const successResponse = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

test('account and machine metadata stay out of persistent journal note while replay identity remains account-scoped', async () => {
  const sanitized = __test.sanitizeIbkrRecordForPersistence(entry.record);
  assert.equal(sanitized.symbol, 'NVDA');
  assert.equal(sanitized.note, '');
  assert.doesNotMatch(JSON.stringify(sanitized), /U1234567|source=IBKR|currency=USD|order_id=/i);

  const durableKey = await __test.hashImportIdentity(entry.idempotencyKey);
  const otherAccountKey = await __test.hashImportIdentity(
    entry.idempotencyKey.replace('U1234567', 'U7654321'),
  );
  assert.notEqual(durableKey, otherAccountKey);
  assert.doesNotMatch(durableKey, /U1234567/);

  const storage = new MemoryStorage();
  let postedBody = null;
  await createIbkrRecord(entry, {
    storage,
    owner: 'user@example.com',
    getToken: () => 'token',
    refreshToken: async () => false,
    apiBaseUrl: 'https://api.example.test',
    fetchImpl: async (_url, init) => {
      postedBody = init.body;
      return successResponse({ success: true, deduplicated: false, record_id: 1 });
    },
  });

  assert.ok(postedBody);
  assert.doesNotMatch(postedBody, /U1234567|account_id|source=IBKR|currency=USD|order_id=/i);
});
