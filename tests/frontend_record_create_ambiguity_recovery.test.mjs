import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginRecordCreateIntent,
  markRecordCreateIntentReconciling,
  readEligibleRecordCreateIntents,
} from '../src/services/recordCreateIntent.js';
import { installRecordCreateAmbiguityRecovery } from '../src/services/recordCreateAmbiguityRecovery.js';
import { ApiHttpError, RequestTimeoutError } from '../src/services/requestErrors.js';

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function createSubscriptionHarness() {
  let listener = null;
  return {
    subscribe(next) {
      listener = next;
      return () => {
        if (listener === next) listener = null;
      };
    },
    emit(event) { listener?.(event); },
  };
}

const flushAsync = async () => {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
};

test('reconciliation lock blocks only the same payload during its bounded window', () => {
  const storage = createStorage();
  const owner = 'user@example.com';
  const firstIds = ['barrier_token_first_1234', 'intent_key_first_123456'];
  const first = beginRecordCreateIntent(storage, owner, { symbol: 'NVDA', qty: 1 }, {
    now: 1_000,
    createOpaqueId: () => firstIds.shift(),
  });

  markRecordCreateIntentReconciling(storage, owner, first.idempotencyKey, {
    now: 1_010,
    windowMs: 100,
  });

  assert.throws(
    () => beginRecordCreateIntent(storage, owner, { symbol: 'NVDA', qty: 1 }, {
      now: 1_050,
      createOpaqueId: () => 'unused_opaque_identifier_1234',
    }),
    error => error?.name === 'RecordCreateReconciliationInProgressError'
      && error?.outcomeAmbiguous === false,
  );
  assert.equal(readEligibleRecordCreateIntents(storage, owner, { now: 1_050 })[0].idempotencyKey, first.idempotencyKey);

  const differentIds = ['barrier_token_second_123', 'intent_key_second_12345'];
  const different = beginRecordCreateIntent(storage, owner, { symbol: 'AAPL', qty: 1 }, {
    now: 1_060,
    createOpaqueId: () => differentIds.shift(),
  });
  assert.notEqual(different.idempotencyKey, first.idempotencyKey);

  const separateStorage = createStorage();
  const expiryIds = ['barrier_token_expiry_123', 'intent_key_expiry_12345'];
  const expiring = beginRecordCreateIntent(separateStorage, owner, { symbol: 'MSFT', qty: 1 }, {
    now: 2_000,
    createOpaqueId: () => expiryIds.shift(),
  });
  markRecordCreateIntentReconciling(separateStorage, owner, expiring.idempotencyKey, {
    now: 2_010,
    windowMs: 100,
  });
  const laterIds = ['barrier_token_later_1234', 'intent_key_later_123456'];
  const later = beginRecordCreateIntent(separateStorage, owner, { symbol: 'MSFT', qty: 1 }, {
    now: 2_111,
    createOpaqueId: () => laterIds.shift(),
  });
  assert.notEqual(later.idempotencyKey, expiring.idempotencyKey);
});

test('ambiguous create failure synchronously locks exact live intent before UI can resubmit and then runs one full recovery', async () => {
  const storage = createStorage();
  const owner = 'user@example.com';
  const ids = ['barrier_token_live_12345', 'intent_key_live_1234567'];
  const payload = { symbol: 'NVDA', qty: 1 };
  const intent = beginRecordCreateIntent(storage, owner, payload, {
    createOpaqueId: () => ids.shift(),
  });
  const harness = createSubscriptionHarness();
  let fetchAllCalls = 0;
  const portfolio = {
    async fetchAll() { fetchAllCalls += 1; return true; },
  };
  const auth = { user: { email: owner }, token: 'token' };

  const stop = installRecordCreateAmbiguityRecovery({
    portfolio,
    auth,
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      queueMicrotask(callback);
      return 1;
    },
  });

  harness.emit({
    pathname: '/api/records/idempotent',
    method: 'POST',
    error: new RequestTimeoutError(30_000),
  });

  const locked = readEligibleRecordCreateIntents(storage, owner)[0];
  assert.equal(locked.idempotencyKey, intent.idempotencyKey);
  assert.equal(Number.isFinite(locked.reconcilingUntil), true);
  assert.throws(
    () => beginRecordCreateIntent(storage, owner, payload),
    error => error?.name === 'RecordCreateReconciliationInProgressError',
  );

  await flushAsync();
  assert.equal(fetchAllCalls, 1);
  stop();
});

test('a newer different create supersedes the old ambiguous intent and cancels its scheduled recovery', async () => {
  const storage = createStorage();
  const owner = 'user@example.com';
  const firstIds = ['barrier_token_old_123456', 'intent_key_old_12345678'];
  beginRecordCreateIntent(storage, owner, { symbol: 'NVDA' }, {
    createOpaqueId: () => firstIds.shift(),
  });
  const harness = createSubscriptionHarness();
  const timers = [];
  let fetchAllCalls = 0;
  const stop = installRecordCreateAmbiguityRecovery({
    portfolio: { async fetchAll() { fetchAllCalls += 1; } },
    auth: { user: { email: owner }, token: 'token' },
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      timers.push(callback);
      return timers.length;
    },
  });

  harness.emit({
    pathname: '/api/records/idempotent',
    method: 'POST',
    error: new RequestTimeoutError(30_000),
  });
  assert.equal(timers.length, 1);

  const nextIds = ['barrier_token_new_123456', 'intent_key_new_12345678'];
  beginRecordCreateIntent(storage, owner, { symbol: 'AAPL' }, {
    createOpaqueId: () => nextIds.shift(),
  });
  timers.shift()();
  await flushAsync();

  assert.equal(fetchAllCalls, 0);
  stop();
});

test('definite 4xx and non-record-create failures never acquire reconciliation authority', async () => {
  const storage = createStorage();
  const owner = 'user@example.com';
  const ids = ['barrier_token_ignore_1234', 'intent_key_ignore_123456'];
  const intent = beginRecordCreateIntent(storage, owner, { symbol: 'NVDA' }, {
    createOpaqueId: () => ids.shift(),
  });
  const harness = createSubscriptionHarness();
  let fetchAllCalls = 0;
  const stop = installRecordCreateAmbiguityRecovery({
    portfolio: { async fetchAll() { fetchAllCalls += 1; } },
    auth: { user: { email: owner }, token: 'token' },
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      callback();
      return 1;
    },
  });

  harness.emit({
    pathname: '/api/records/idempotent',
    method: 'POST',
    error: new ApiHttpError('Conflict', { status: 409 }),
  });
  harness.emit({
    pathname: '/api/trigger-update',
    method: 'POST',
    error: new RequestTimeoutError(30_000),
  });
  await flushAsync();

  assert.equal(fetchAllCalls, 0);
  const current = readEligibleRecordCreateIntents(storage, owner)[0];
  assert.equal(current.idempotencyKey, intent.idempotencyKey);
  assert.equal(current.reconcilingUntil, undefined);
  stop();
});
