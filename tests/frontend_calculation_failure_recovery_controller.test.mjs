import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, reactive } from 'vue';

import { markAutomaticRecalculationDirty } from '../src/services/automaticRecalculationState.js';
import { claimAutomaticFailureRetry } from '../src/services/calculationFailureRecovery.js';
import { installCalculationFailureRecovery } from '../src/services/calculationFailureRecoveryController.js';

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
  await nextTick();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createHarness = ({ timer = callback => callback() } = {}) => {
  const storage = createStorage();
  const auth = reactive({ user: { email: 'user@example.com' } });
  const calls = [];
  const notifications = [];
  let claimCounter = 0;
  const portfolio = reactive({
    calculationJob: null,
    selectedBenchmark: 'SPY',
    async triggerUpdate(benchmark, options) {
      calls.push({ benchmark, options });
      return true;
    },
  });
  return {
    storage,
    auth,
    calls,
    notifications,
    portfolio,
    install() {
      return installCalculationFailureRecovery({
        portfolio,
        auth,
        storage,
        retryDelayMs: 0,
        setTimeoutImpl: timer,
        claimRetry: (...args) => {
          claimCounter += 1;
          return claimAutomaticFailureRetry(...args, {
            settleMs: 0,
            delay: async () => {},
            createClaimId: () => `controller_claim_${String(claimCounter).padStart(8, '0')}`,
          });
        },
        notify(message, type) {
          notifications.push({ message, type });
        },
      });
    },
  };
};

test('allowlisted terminal failure retries the current dirty generation exactly once', async () => {
  const harness = createHarness();
  markAutomaticRecalculationDirty(
    harness.storage, 'user@example.com', 'SPY',
    { createToken: () => 'generation_token_retry_0001' },
  );
  const stop = harness.install();
  harness.portfolio.calculationJob = {
    id: 'job_1234567890123456789012', status: 'failed', error_code: 'MARKET_DATA_FAILED',
  };
  await flushAsync();
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].benchmark, 'SPY');
  assert.equal(harness.calls[0].options.automatic, true);
  assert.match(harness.notifications[0].message, /自動安全重試一次/);

  harness.portfolio.calculationJob = {
    id: 'job_2234567890123456789012', status: 'failed', error_code: 'MARKET_DATA_FAILED',
  };
  await flushAsync();
  assert.equal(harness.calls.length, 1);
  assert.match(harness.notifications.at(-1).message, /已達自動重試上限|其他分頁接手/);
  stop();
});

test('financial integrity and record validation failures never auto retry', async () => {
  for (const errorCode of ['RECONCILIATION_FAILED', 'SNAPSHOT_VALIDATION_FAILED', 'RECORD_VALIDATION_FAILED']) {
    const harness = createHarness();
    markAutomaticRecalculationDirty(
      harness.storage, 'user@example.com', 'SPY',
      { createToken: () => `generation_${errorCode.toLowerCase()}_0001` },
    );
    const stop = harness.install();
    harness.portfolio.calculationJob = {
      id: 'job_3234567890123456789012', status: 'failed', error_code: errorCode,
    };
    await flushAsync();
    assert.equal(harness.calls.length, 0, errorCode);
    assert.equal(harness.notifications.at(-1).type, 'error');
    stop();
  }
});

test('retry is cancelled if a newer dirty generation appears during backoff', async () => {
  let timerCallback = null;
  const harness = createHarness({ timer(callback) { timerCallback = callback; } });
  markAutomaticRecalculationDirty(
    harness.storage, 'user@example.com', 'SPY',
    { createToken: () => 'generation_token_before_0001' },
  );
  const stop = harness.install();
  harness.portfolio.calculationJob = {
    id: 'job_4234567890123456789012', status: 'failed', error_code: 'SNAPSHOT_UPLOAD_FAILED',
  };
  await flushAsync();
  assert.equal(typeof timerCallback, 'function');

  markAutomaticRecalculationDirty(
    harness.storage, 'user@example.com', 'QQQ',
    { createToken: () => 'generation_token_after_00001' },
  );
  timerCallback();
  await flushAsync();
  assert.equal(harness.calls.length, 0);
  stop();
});

test('retry is cancelled after owner change or when another calculation is already active', async () => {
  for (const scenario of ['owner', 'active']) {
    let timerCallback = null;
    const harness = createHarness({ timer(callback) { timerCallback = callback; } });
    markAutomaticRecalculationDirty(
      harness.storage, 'user@example.com', 'SPY',
      { createToken: () => `generation_token_${scenario}_000001` },
    );
    const stop = harness.install();
    harness.portfolio.calculationJob = {
      id: 'job_5234567890123456789012', status: 'failed', error_code: 'RECORDS_API_FAILED',
    };
    await flushAsync();

    if (scenario === 'owner') {
      harness.auth.user.email = 'other@example.com';
    } else {
      harness.portfolio.calculationJob = {
        id: 'job_6234567890123456789012', status: 'running', error_code: null,
      };
    }
    timerCallback();
    await flushAsync();
    assert.equal(harness.calls.length, 0, scenario);
    stop();
  }
});

test('retryable failure without a Phase 2 dirty generation does not invent calculation intent', async () => {
  const harness = createHarness();
  const stop = harness.install();
  harness.portfolio.calculationJob = {
    id: 'job_7234567890123456789012', status: 'failed', error_code: 'MARKET_DATA_FAILED',
  };
  await flushAsync();
  assert.equal(harness.calls.length, 0);
  assert.match(harness.notifications.at(-1).message, /沒有待自動重算狀態.*停止自動重試/);
  assert.doesNotMatch(harness.notifications.at(-1).message, /將自動.*重試/);
  stop();
});
