import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithDeadline } from '../src/services/fetchDeadline.js';
import { subscribeRequestFailure } from '../src/services/requestFailureSignal.js';
import { MalformedApiResponseError, RequestAbortedError } from '../src/services/requestErrors.js';

const neverFireTimer = () => 1;
const noop = () => {};

test('transport failure publishes path, method, and exact error without changing request semantics', async () => {
  const events = [];
  const unsubscribe = subscribeRequestFailure(event => events.push(event));
  const failure = new Error('network down');

  await assert.rejects(
    fetchWithDeadline(
      'https://api.example.test/api/trigger-update?x=1',
      { method: 'POST' },
      {
        timeoutMs: 30_000,
        fetchImpl: async () => { throw failure; },
        setTimeoutImpl: neverFireTimer,
        clearTimeoutImpl: noop,
      },
    ),
    error => error === failure,
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].pathname, '/api/trigger-update');
  assert.equal(events[0].method, 'POST');
  assert.equal(events[0].error, failure);
  unsubscribe();
});

test('response-handler ambiguity is published so idempotent callers can reconcile it', async () => {
  const events = [];
  const unsubscribe = subscribeRequestFailure(event => events.push(event));
  const malformed = new MalformedApiResponseError('bad json');

  await assert.rejects(
    fetchWithDeadline(
      'https://api.example.test/api/trigger-update',
      { method: 'POST' },
      {
        timeoutMs: 30_000,
        fetchImpl: async () => ({ ok: true }),
        responseHandler: async () => { throw malformed; },
        setTimeoutImpl: neverFireTimer,
        clearTimeoutImpl: noop,
      },
    ),
    error => error === malformed,
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].error, malformed);
  unsubscribe();
});

test('already-aborted external signal does not publish recovery evidence', async () => {
  const events = [];
  const unsubscribe = subscribeRequestFailure(event => events.push(event));
  const controller = new AbortController();
  controller.abort('user-cancel');

  await assert.rejects(
    fetchWithDeadline(
      'https://api.example.test/api/trigger-update',
      { method: 'POST', signal: controller.signal },
      {
        timeoutMs: 30_000,
        fetchImpl: async () => ({ ok: true }),
        setTimeoutImpl: neverFireTimer,
        clearTimeoutImpl: noop,
      },
    ),
    RequestAbortedError,
  );

  assert.equal(events.length, 0);
  unsubscribe();
});
