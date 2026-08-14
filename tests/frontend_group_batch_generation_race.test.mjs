import assert from 'node:assert/strict';
import test from 'node:test';

import { updateRecordTagsSequentially, PartialRecordTagBatchError } from '../src/services/groupRecordMutation.js';
import { AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY } from '../src/services/projectStorage.js';
import { RequestTimeoutError } from '../src/services/requestErrors.js';

function createObservedStorage() {
  const values = new Map();
  const dirtyTokens = [];
  return {
    dirtyTokens,
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      values.set(String(key), String(value));
      if (key === AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY) {
        dirtyTokens.push(JSON.parse(String(value)).token);
      }
    },
    removeItem(key) { values.delete(key); },
  };
}

function signedToken() {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ email: 'user@example.com', exp: 4_102_444_800 })}.signature`;
}

function record(id) {
  return {
    id,
    txn_date: '2026-08-14',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 1,
    price: 100,
    fee: 0,
    tax: 0,
    tag: 'Old',
    note: '',
  };
}

const okResponse = () => ({
  ok: true,
  status: 200,
  async json() { return { success: true }; },
});

test('every verified group-row commit rotates the dirty generation', async () => {
  const storage = createObservedStorage();
  storage.setItem('user_benchmark', 'SPY');

  await updateRecordTagsSequentially({
    apiBaseUrl: 'https://example.invalid',
    token: signedToken(),
    storage,
    updates: [
      { record: record(1), tag: 'A' },
      { record: record(2), tag: 'B' },
    ],
    fetchImpl: async () => okResponse(),
  });

  assert.equal(storage.dirtyTokens.length, 2);
  assert.notEqual(storage.dirtyTokens[0], storage.dirtyTokens[1]);
});

test('an ambiguous row after a committed row rotates dirty generation again before stopping', async () => {
  const storage = createObservedStorage();
  storage.setItem('user_benchmark', 'SPY');
  const calls = [];

  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: signedToken(),
      storage,
      updates: [
        { record: record(1), tag: 'A' },
        { record: record(2), tag: 'B' },
        { record: record(3), tag: 'C' },
      ],
      fetchImpl: async (_url, init) => {
        const id = JSON.parse(init.body).id;
        calls.push(id);
        if (id === 2) throw new RequestTimeoutError(30_000);
        return okResponse();
      },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 1
      && error.failedRecordId === 2
      && error.outcomeAmbiguous === true,
  );

  assert.deepEqual(calls, [1, 2]);
  assert.equal(storage.dirtyTokens.length, 2);
  assert.notEqual(storage.dirtyTokens[0], storage.dirtyTokens[1]);
});
