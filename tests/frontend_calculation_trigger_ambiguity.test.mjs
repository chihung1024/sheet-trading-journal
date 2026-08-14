import assert from 'node:assert/strict';
import test from 'node:test';

import { rememberPendingCalculationRequest } from '../src/services/calculationJobState.js';
import { installCalculationTriggerAmbiguityRecovery } from '../src/services/calculationTriggerAmbiguityRecovery.js';
import {
  ApiHttpError,
  MalformedApiResponseError,
  RequestTimeoutError,
} from '../src/services/requestErrors.js';

const OWNER = 'user@example.com';
const KEY_A = 'trigger_key_1234567890';
const KEY_B = 'trigger_key_0987654321';
const NOW = Date.UTC(2026, 7, 14, 5, 45, 0);

const createStorage = () => {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
};

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createHarness = () => {
  const storage = createStorage();
  const auth = { user: { email: OWNER } };
  const calls = [];
  const notifications = [];
  const timers = [];
  let listener = null;
  const portfolio = {
    selectedBenchmark: 'SPY',
    async triggerUpdate(benchmark, options) {
      calls.push({ benchmark, options });
      return true;
    },
  };
  const stop = installCalculationTriggerAmbiguityRecovery({
    portfolio,
    auth,
    storage,
    notify(message, type) { notifications.push({ message, type }); },
    retryDelayMs: 0,
    setTimeoutImpl(callback) { timers.push(callback); },
    subscribe(callback) {
      listener = callback;
      return () => { listener = null; };
    },
  });
  return { storage, auth, calls, notifications, timers, portfolio, stop, emit: event => listener?.(event) };
};

const remember = (harness, { key = KEY_A, benchmark = 'SPY', jobId = null } = {}) => (
  rememberPendingCalculationRequest(harness.storage, OWNER, {
    key,
    benchmark,
    jobId,
    createdAt: NOW,
  })
);

const triggerFailureEvent = error => ({
  pathname: '/api/trigger-update',
  method: 'POST',
  error,
});

test('timeout ambiguity replays exactly the same durable pending calculation intent once', async () => {
  const harness = createHarness();
  remember(harness);
  harness.emit(triggerFailureEvent(new RequestTimeoutError(30_000)));
  await flushAsync();
  assert.equal(harness.timers.length, 1);
  harness.timers.shift()();
  await flushAsync();

  assert.deepEqual(harness.calls, [{
    benchmark: 'SPY',
    options: { automatic: true, ambiguityReplay: true },
  }]);
  assert.match(harness.notifications[0].message, /相同識別碼.*原計算工作/);

  harness.emit(triggerFailureEvent(new RequestTimeoutError(30_000)));
  await flushAsync();
  assert.equal(harness.timers.length, 0);
  assert.equal(harness.calls.length, 1);
  harness.stop();
});

test('malformed successful response is treated as ambiguous and reconciled with the existing key', async () => {
  const harness = createHarness();
  remember(harness, { jobId: 'job_ABCDEFGHIJKLMNOPQRSTUV' });
  harness.emit(triggerFailureEvent(new MalformedApiResponseError('invalid json')));
  await flushAsync();
  harness.timers.shift()();
  await flushAsync();
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].benchmark, 'SPY');
  harness.stop();
});

test('explicit allowlisted dispatch error may reconcile same-key terminal job', async () => {
  const harness = createHarness();
  remember(harness);
  harness.emit(triggerFailureEvent(new ApiHttpError('dispatch failed', {
    status: 502,
    apiCode: 'GITHUB_DISPATCH_FAILED',
  })));
  await flushAsync();
  harness.timers.shift()();
  await flushAsync();
  assert.equal(harness.calls.length, 1);
  harness.stop();
});

test('explicit configuration, auth, workflow, and unknown API errors fail closed', async () => {
  for (const apiCode of [
    'GITHUB_DISPATCH_NOT_CONFIGURED',
    'GITHUB_DISPATCH_INVALID_RESPONSE',
    'GITHUB_AUTH_FAILED',
    'GITHUB_PERMISSION_DENIED',
    'GITHUB_WORKFLOW_NOT_FOUND',
    'GITHUB_DISPATCH_REJECTED',
    'GITHUB_UNAVAILABLE',
  ]) {
    const harness = createHarness();
    remember(harness);
    harness.emit(triggerFailureEvent(new ApiHttpError(apiCode, { status: 503, apiCode })));
    await flushAsync();
    assert.equal(harness.timers.length, 0, apiCode);
    assert.equal(harness.calls.length, 0, apiCode);
    harness.stop();
  }
});

test('owner, benchmark, or pending-generation replacement during backoff cancels old replay', async () => {
  for (const scenario of ['owner', 'benchmark', 'pending']) {
    const harness = createHarness();
    remember(harness);
    harness.emit(triggerFailureEvent(new RequestTimeoutError(30_000)));
    await flushAsync();
    assert.equal(harness.timers.length, 1, scenario);

    if (scenario === 'owner') harness.auth.user.email = 'other@example.com';
    if (scenario === 'benchmark') harness.portfolio.selectedBenchmark = 'QQQ';
    if (scenario === 'pending') {
      rememberPendingCalculationRequest(harness.storage, OWNER, {
        key: KEY_B,
        benchmark: 'SPY',
        jobId: null,
        createdAt: NOW + 1,
      });
    }

    harness.timers.shift()();
    await flushAsync();
    assert.equal(harness.calls.length, 0, scenario);
    harness.stop();
  }
});

test('failure event without a valid pending trigger intent never creates a new idempotency key', async () => {
  const harness = createHarness();
  harness.emit(triggerFailureEvent(new RequestTimeoutError(30_000)));
  await flushAsync();
  assert.equal(harness.timers.length, 0);
  assert.equal(harness.calls.length, 0);
  harness.stop();
});

test('non-trigger failures are ignored even when a calculation pending intent exists', async () => {
  const harness = createHarness();
  remember(harness);
  harness.emit({
    pathname: '/api/records/idempotent',
    method: 'POST',
    error: new RequestTimeoutError(30_000),
  });
  await flushAsync();
  assert.equal(harness.timers.length, 0);
  assert.equal(harness.calls.length, 0);
  harness.stop();
});
