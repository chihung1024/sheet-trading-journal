import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, reactive } from 'vue';

import {
  installDataReadSelfRecovery,
  isRetryableDataReadFailure,
} from '../src/services/dataReadSelfRecovery.js';
import {
  ApiHttpError,
  MalformedApiResponseError,
  RequestAbortedError,
  RequestTimeoutError,
} from '../src/services/requestErrors.js';

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

test('only safe GET read failures are eligible for bounded self recovery', () => {
  assert.equal(isRetryableDataReadFailure({
    pathname: '/api/records',
    method: 'GET',
    error: new RequestTimeoutError(30_000),
  }), true);
  assert.equal(isRetryableDataReadFailure({
    pathname: '/api/portfolio',
    method: 'GET',
    error: new MalformedApiResponseError(),
  }), true);
  assert.equal(isRetryableDataReadFailure({
    pathname: '/api/user-settings',
    method: 'GET',
    error: new ApiHttpError('unavailable', { status: 503 }),
  }), true);
  assert.equal(isRetryableDataReadFailure({
    pathname: '/api/records',
    method: 'GET',
    error: new TypeError('network failed'),
  }), true);

  for (const event of [
    { pathname: '/api/records', method: 'GET', error: new ApiHttpError('not found', { status: 404 }) },
    { pathname: '/api/records', method: 'GET', error: new RequestAbortedError() },
    { pathname: '/api/records', method: 'POST', error: new RequestTimeoutError(30_000) },
    { pathname: '/api/calculation-jobs/job_ABCDEFGHIJKLMNOPQRSTUV', method: 'GET', error: new RequestTimeoutError(30_000) },
  ]) {
    assert.equal(isRetryableDataReadFailure(event), false);
  }
});

test('a failed read episode receives at most one automatic fetchAll retry until a successful load', async () => {
  const harness = createSubscriptionHarness();
  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loading',
    async fetchAll() {
      calls += 1;
      throw new TypeError('still offline');
    },
  });
  const auth = reactive({
    user: { email: 'user@example.com' },
    token: 'token-1',
  });

  const stop = installDataReadSelfRecovery({
    portfolio,
    auth,
    subscribe: harness.subscribe,
    setTimeoutImpl: callback => {
      callback();
      return 1;
    },
    notify: () => {
      throw new Error('toast transport failed');
    },
  });

  harness.emit({
    pathname: '/api/records',
    method: 'GET',
    error: new RequestTimeoutError(30_000),
  });
  portfolio.portfolioReadStatus = 'error';
  await flushAsync();
  assert.equal(calls, 1);

  harness.emit({
    pathname: '/api/portfolio',
    method: 'GET',
    error: new TypeError('network failed again'),
  });
  await flushAsync();
  assert.equal(calls, 1, 'same failed read episode must not loop');

  portfolio.portfolioReadStatus = 'loaded';
  await nextTick();
  portfolio.portfolioReadStatus = 'loading';
  harness.emit({
    pathname: '/api/portfolio',
    method: 'GET',
    error: new ApiHttpError('upstream unavailable', { status: 503 }),
  });
  portfolio.portfolioReadStatus = 'error';
  await flushAsync();
  assert.equal(calls, 2, 'a new episode after verified load may receive one new retry');

  stop();
});

test('owner change cancels old-owner retry without consuming the new owner episode', async () => {
  const harness = createSubscriptionHarness();
  const timers = [];
  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loading',
    async fetchAll() {
      calls += 1;
      portfolio.portfolioReadStatus = 'loaded';
      return true;
    },
  });
  const auth = reactive({
    user: { email: 'first@example.com' },
    token: 'token-1',
  });

  const stop = installDataReadSelfRecovery({
    portfolio,
    auth,
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
  portfolio.portfolioReadStatus = 'error';
  await nextTick();
  assert.equal(timers.length, 1);

  auth.user.email = 'second@example.com';
  auth.token = 'token-2';
  await nextTick();
  harness.emit({
    pathname: '/api/portfolio',
    method: 'GET',
    error: new TypeError('second owner network failure'),
  });

  timers.shift()();
  await flushAsync();
  assert.equal(calls, 0, 'old owner timer must never retry under the new owner');
  assert.equal(timers.length, 1, 'new owner pending failure must receive its own bounded timer');

  timers.shift()();
  await flushAsync();
  assert.equal(calls, 1);
  assert.equal(portfolio.portfolioReadStatus, 'loaded');

  stop();
});

test('offline browser and stopped controller do not issue an automatic read retry', async () => {
  const harness = createSubscriptionHarness();
  let calls = 0;
  const portfolio = reactive({
    portfolioReadStatus: 'loading',
    async fetchAll() {
      calls += 1;
      return true;
    },
  });
  const auth = reactive({ user: { email: 'user@example.com' }, token: 'token' });
  const timers = [];

  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: false },
  });
  try {
    const stop = installDataReadSelfRecovery({
      portfolio,
      auth,
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
    portfolio.portfolioReadStatus = 'error';
    await nextTick();
    assert.equal(timers.length, 1);
    timers.shift()();
    await flushAsync();
    assert.equal(calls, 0);

    stop();
    harness.emit({
      pathname: '/api/records',
      method: 'GET',
      error: new RequestTimeoutError(30_000),
    });
    await flushAsync();
    assert.equal(calls, 0);
  } finally {
    if (originalNavigator === undefined) {
      delete globalThis.navigator;
    } else {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  }
});
