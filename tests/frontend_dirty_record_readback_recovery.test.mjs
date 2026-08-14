import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, reactive } from 'vue';

import { installDataReadSelfRecovery } from '../src/services/dataReadSelfRecovery.js';
import { markAutomaticRecalculationDirty } from '../src/services/automaticRecalculationState.js';
import { AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY } from '../src/services/projectStorage.js';
import { RequestTimeoutError } from '../src/services/requestErrors.js';

const flushAsync = async () => {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
};

const createSubscriptionHarness = () => {
  let listener = null;
  return {
    subscribe(next) {
      listener = next;
      return () => {
        if (listener === next) listener = null;
      };
    },
    emit(event) {
      listener?.(event);
    },
  };
};

const createStorage = () => {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
  };
};

test('dirty standalone /api/records readback receives one full fetchAll recovery even while read status is loaded', async () => {
  const harness = createSubscriptionHarness();
  const storage = createStorage();
  const owner = 'user@example.com';
  markAutomaticRecalculationDirty(storage, owner, 'SPY');

  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loaded',
    async fetchAll() {
      calls += 1;
      portfolio.portfolioReadStatus = 'loading';
      await nextTick();
      portfolio.portfolioReadStatus = 'loaded';
      return true;
    },
  });
  const auth = reactive({ user: { email: owner }, token: 'token' });

  const stop = installDataReadSelfRecovery({
    portfolio,
    auth,
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      callback();
      return 1;
    },
  });

  harness.emit({
    pathname: '/api/records',
    method: 'GET',
    error: new RequestTimeoutError(30_000),
  });
  await flushAsync();

  assert.equal(calls, 1);
  assert.equal(portfolio.portfolioReadStatus, 'loaded');
  stop();
});

test('standalone /api/records failure with no dirty mutation intent does not broaden automatic recovery', async () => {
  const harness = createSubscriptionHarness();
  const storage = createStorage();
  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loaded',
    async fetchAll() {
      calls += 1;
      return true;
    },
  });
  const auth = reactive({ user: { email: 'user@example.com' }, token: 'token' });

  const stop = installDataReadSelfRecovery({
    portfolio,
    auth,
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      callback();
      return 1;
    },
  });

  harness.emit({
    pathname: '/api/records',
    method: 'GET',
    error: new RequestTimeoutError(30_000),
  });
  await flushAsync();

  assert.equal(calls, 0);
  stop();
});

test('dirty evidence is captured at failure time so later calculation settlement cannot cancel required readback', async () => {
  const harness = createSubscriptionHarness();
  const storage = createStorage();
  const owner = 'user@example.com';
  markAutomaticRecalculationDirty(storage, owner, 'SPY');

  const timers = [];
  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loaded',
    async fetchAll() {
      calls += 1;
      return true;
    },
  });
  const auth = reactive({ user: { email: owner }, token: 'token' });

  const stop = installDataReadSelfRecovery({
    portfolio,
    auth,
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      timers.push(callback);
      return timers.length;
    },
  });

  harness.emit({
    pathname: '/api/records',
    method: 'GET',
    error: new RequestTimeoutError(30_000),
  });
  assert.equal(timers.length, 1);

  // The record read itself is still stale even if calculation settlement
  // clears the dirty key before this bounded readback timer executes.
  storage.removeItem(AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY);
  timers.shift()();
  await flushAsync();

  assert.equal(calls, 1);
  stop();
});

test('a verified full load during backoff cancels the stale standalone readback timer', async () => {
  const harness = createSubscriptionHarness();
  const storage = createStorage();
  const owner = 'user@example.com';
  markAutomaticRecalculationDirty(storage, owner, 'SPY');

  const timers = [];
  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loaded',
    async fetchAll() {
      calls += 1;
      return true;
    },
  });
  const auth = reactive({ user: { email: owner }, token: 'token' });

  const stop = installDataReadSelfRecovery({
    portfolio,
    auth,
    storage,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      timers.push(callback);
      return timers.length;
    },
  });

  harness.emit({
    pathname: '/api/records',
    method: 'GET',
    error: new RequestTimeoutError(30_000),
  });
  assert.equal(timers.length, 1);

  // Another lifecycle performs a successful full read before our timer fires.
  portfolio.portfolioReadStatus = 'loading';
  await nextTick();
  portfolio.portfolioReadStatus = 'loaded';
  await nextTick();

  timers.shift()();
  await flushAsync();

  assert.equal(calls, 0, 'verified later load already repaired the stale readback');
  stop();
});
