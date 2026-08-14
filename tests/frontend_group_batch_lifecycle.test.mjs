import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PartialRecordTagBatchError,
  updateRecordTagsSequentially,
} from '../src/services/groupRecordMutation.js';
import {
  beginRecordCreateIntent,
  readEligibleRecordCreateIntents,
} from '../src/services/recordCreateIntent.js';
import { readAutomaticRecalculationStatus } from '../src/services/automaticRecalculationState.js';
import { AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY } from '../src/services/projectStorage.js';
import { RequestTimeoutError } from '../src/services/requestErrors.js';

function createStorage({ failSetKey = null } = {}) {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === failSetKey) throw new Error(`blocked write: ${key}`);
      values.set(String(key), String(value));
    },
    removeItem(key) { values.delete(key); },
  };
}

function signedToken(email = 'User@Example.com') {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ email, exp: 4_102_444_800 })}.signature`;
}

function sourceRecord(id = 1) {
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

function okResponse() {
  return {
    ok: true,
    status: 200,
    async json() { return { success: true }; },
  };
}

test('browser batch supersedes an eligible create intent and writes one dirty generation after first verified commit', async () => {
  const storage = createStorage();
  storage.setItem('user_benchmark', 'qqq');
  const owner = 'user@example.com';
  const ids = ['barrier_token_1234567890', 'intent_key_1234567890'];
  beginRecordCreateIntent(storage, owner, { symbol: 'AAPL', txn_type: 'BUY' }, {
    now: 1000,
    createOpaqueId: () => ids.shift(),
  });
  assert.equal(readEligibleRecordCreateIntents(storage, owner, { now: 1000 }).length, 1);

  const calls = [];
  const result = await updateRecordTagsSequentially({
    apiBaseUrl: 'https://example.invalid',
    token: signedToken(),
    storage,
    updates: [
      { record: sourceRecord(1), tag: 'A' },
      { record: sourceRecord(2), tag: 'B' },
    ],
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body).id);
      return okResponse();
    },
  });

  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.succeeded, 2);
  assert.equal(result.total, 2);
  assert.equal(readEligibleRecordCreateIntents(storage, owner).length, 0);
  const status = readAutomaticRecalculationStatus(storage, owner);
  assert.equal(status.dirty, true);
  assert.equal(status.generation.benchmark, 'QQQ');
  assert.equal(result.recoveryGeneration.token, status.generation.token);
});

test('recovery-state persistence failure stops the batch immediately after the first verified commit', async () => {
  const storage = createStorage({ failSetKey: AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY });
  storage.setItem('user_benchmark', 'SPY');
  const calls = [];

  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: signedToken(),
      storage,
      updates: [
        { record: sourceRecord(1), tag: 'A' },
        { record: sourceRecord(2), tag: 'B' },
      ],
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(init.body).id);
        return okResponse();
      },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 1
      && error.failedRecordId === 1
      && error.cause?.code === 'RECOVERY_STATE_FAILED'
      && error.outcomeAmbiguous === false
      && error.recoveryStateError instanceof Error,
  );

  assert.deepEqual(calls, [1]);
});

test('an ambiguous first PUT creates dirty recovery state and never sends the next row', async () => {
  const storage = createStorage();
  storage.setItem('user_benchmark', 'SPY');
  const calls = [];

  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: signedToken(),
      storage,
      updates: [
        { record: sourceRecord(1), tag: 'A' },
        { record: sourceRecord(2), tag: 'B' },
      ],
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(init.body).id);
        throw new RequestTimeoutError(30_000);
      },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 0
      && error.failedRecordId === 1
      && error.outcomeAmbiguous === true,
  );

  assert.deepEqual(calls, [1]);
  assert.equal(readAutomaticRecalculationStatus(storage, 'user@example.com').dirty, true);
});

test('invalid signed-owner context fails before any browser batch PUT is sent', async () => {
  const storage = createStorage();
  storage.setItem('user_benchmark', 'SPY');
  let calls = 0;

  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: 'not-a-jwt',
      storage,
      updates: [{ record: sourceRecord(1), tag: 'A' }],
      fetchImpl: async () => {
        calls += 1;
        return okResponse();
      },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 0
      && error.cause?.code === 'AUTH_TOKEN_INVALID'
      && error.outcomeAmbiguous === false,
  );

  assert.equal(calls, 0);
});
