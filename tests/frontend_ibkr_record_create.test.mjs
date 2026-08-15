import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginIbkrRecordCreateIntent,
  createIbkrRecord,
  __test,
} from '../src/services/ibkrRecordCreate.js';
import {
  PENDING_RECORD_CREATE_V1_STORAGE_PREFIX,
  RECORD_MUTATION_BARRIER_STORAGE_KEY,
} from '../src/services/projectStorage.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failRemove = false;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) {
    if (this.failRemove) throw new Error('remove unavailable');
    this.values.delete(String(key));
  }
}

const OWNER = 'user@example.com';
const API_BASE_URL = 'https://api.example.test';
const ENTRY = Object.freeze({
  idempotencyKey: 'IBKR~ORDER~20260814~U123~487287953~NVDA~BUY',
  record: Object.freeze({
    txn_date: '2026-08-14',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 15,
    price: 103.3333333333,
    fee: 1.5,
    tax: 0.1,
    tag: '',
    note: 'source=IBKR; order_id=487287953',
  }),
});
const PERSISTED_RECORD = Object.freeze({ ...ENTRY.record, note: '' });

const successResponse = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

const writerOptions = ({ storage, fetchImpl, getToken = () => 'token-a', refreshToken = async () => false }) => ({
  storage,
  owner: OWNER,
  getToken,
  refreshToken,
  apiBaseUrl: API_BASE_URL,
  fetchImpl,
});

test('IBKR import identity hashes deterministically into the existing durable opaque-key alphabet', async () => {
  const first = await __test.hashImportIdentity(ENTRY.idempotencyKey);
  const replay = await __test.hashImportIdentity(ENTRY.idempotencyKey);
  const other = await __test.hashImportIdentity(`${ENTRY.idempotencyKey}.other`);
  assert.equal(first, replay);
  assert.notEqual(first, other);
  assert.match(first, /^ibkr\.[0-9a-f]{64}$/);
  assert.doesNotMatch(first, /~/);
});

test('durable IBKR intent preserves exact sanitized record body, random barrier, and deterministic record key', async () => {
  const storage = new MemoryStorage();
  const intent = await beginIbkrRecordCreateIntent(storage, OWNER, ENTRY.record, ENTRY.idempotencyKey);
  const expectedKey = await __test.hashImportIdentity(ENTRY.idempotencyKey);

  assert.equal(intent.owner, OWNER);
  assert.equal(intent.body, JSON.stringify(PERSISTED_RECORD));
  assert.equal(intent.idempotencyKey, expectedKey);
  assert.notEqual(intent.barrierToken, expectedKey);
  assert.match(intent.barrierToken, /^[A-Za-z0-9._-]{16,128}$/);
  assert.equal(JSON.parse(storage.getItem(RECORD_MUTATION_BARRIER_STORAGE_KEY)).token, intent.barrierToken);
  assert.equal(
    JSON.parse(storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${expectedKey}`)).body,
    JSON.stringify(PERSISTED_RECORD),
  );
});

test('confirmed IBKR create sends exact durable key/sanitized body and clears pending intent', async () => {
  const storage = new MemoryStorage();
  const requests = [];
  const result = await createIbkrRecord(ENTRY, writerOptions({
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return successResponse({ success: true, deduplicated: false, record_id: 99 });
    },
  }));

  assert.equal(result.committed, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.recordId, 99);
  assert.equal(result.recoveryStateError, null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${API_BASE_URL}/api/records`);
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.body, JSON.stringify(PERSISTED_RECORD));
  assert.equal(requests[0].init.headers.Authorization, 'Bearer token-a');
  assert.equal(
    requests[0].init.headers['Idempotency-Key'],
    await __test.hashImportIdentity(ENTRY.idempotencyKey),
  );
  assert.equal(
    storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${requests[0].init.headers['Idempotency-Key']}`),
    null,
  );
});

test('post-commit local cleanup failure preserves confirmed ledger truth and reports recovery-state warning', async () => {
  const storage = new MemoryStorage();
  const durableKey = await __test.hashImportIdentity(ENTRY.idempotencyKey);
  const resultPromise = createIbkrRecord(ENTRY, writerOptions({
    storage,
    fetchImpl: async () => {
      storage.failRemove = true;
      return successResponse({ success: true, deduplicated: false, record_id: 100 });
    },
  }));
  const result = await resultPromise;

  assert.equal(result.committed, true);
  assert.equal(result.outcomeAmbiguous, false);
  assert.equal(result.recordId, 100);
  assert.match(result.recoveryStateError?.message || '', /remove unavailable/);
  assert.notEqual(
    storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${durableKey}`),
    null,
  );
});

test('401 refresh retries the same durable intent exactly once with the refreshed token', async () => {
  const storage = new MemoryStorage();
  const keys = [];
  const tokens = [];
  let token = 'expired-token';
  let call = 0;
  const result = await createIbkrRecord(ENTRY, writerOptions({
    storage,
    getToken: () => token,
    refreshToken: async () => {
      token = 'fresh-token';
      return true;
    },
    fetchImpl: async (_url, init) => {
      call += 1;
      keys.push(init.headers['Idempotency-Key']);
      tokens.push(init.headers.Authorization);
      if (call === 1) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return successResponse({ success: true, deduplicated: true, record_id: 99 });
    },
  }));

  assert.equal(result.deduplicated, true);
  assert.equal(call, 2);
  assert.equal(keys[0], keys[1]);
  assert.deepEqual(tokens, ['Bearer expired-token', 'Bearer fresh-token']);
});

test('refresh failure after definite 401 preserves the original definite rejection classification', async () => {
  const storage = new MemoryStorage();
  await assert.rejects(
    createIbkrRecord(ENTRY, writerOptions({
      storage,
      refreshToken: async () => { throw new Error('refresh offline'); },
      fetchImpl: async () => new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    })),
    error => (
      error?.status === 401
      && error?.outcomeAmbiguous === false
      && error?.refreshError?.message === 'refresh offline'
    ),
  );
  const durableKey = await __test.hashImportIdentity(ENTRY.idempotencyKey);
  const terminal = JSON.parse(
    storage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${durableKey}`),
  );
  assert.equal(terminal.state, 'terminal');
  assert.equal(Object.hasOwn(terminal, 'body'), false);
});

test('definite 409 rejection tombstones body while ambiguous network failure preserves live sanitized replay intent', async () => {
  const rejectedStorage = new MemoryStorage();
  await assert.rejects(
    createIbkrRecord(ENTRY, writerOptions({
      storage: rejectedStorage,
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        error: 'conflict',
        error_meta: { code: 'IDEMPOTENCY_CONFLICT' },
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    })),
    error => error?.status === 409 && error?.outcomeAmbiguous === false,
  );
  const durableKey = await __test.hashImportIdentity(ENTRY.idempotencyKey);
  const terminal = JSON.parse(
    rejectedStorage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${durableKey}`),
  );
  assert.equal(terminal.state, 'terminal');
  assert.equal(Object.hasOwn(terminal, 'body'), false);

  const ambiguousStorage = new MemoryStorage();
  await assert.rejects(
    createIbkrRecord(ENTRY, writerOptions({
      storage: ambiguousStorage,
      fetchImpl: async () => { throw new Error('network lost'); },
    })),
    error => error?.outcomeAmbiguous === true,
  );
  const live = JSON.parse(
    ambiguousStorage.getItem(`${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${durableKey}`),
  );
  assert.equal(live.state, 'live');
  assert.equal(live.body, JSON.stringify(PERSISTED_RECORD));
});