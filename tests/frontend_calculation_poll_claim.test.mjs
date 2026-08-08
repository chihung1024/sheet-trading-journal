import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CALCULATION_JOB_POLL_CLAIM_SETTLE_MS,
  claimCalculationJobPoll,
  clearCalculationJobPollClaim,
  getCalculationJobPollClaimStorageKey,
} from '../src/services/calculationJobPollClaim.js';

const JOB_ID = 'job_abcdefghijklmnopqrstuv';
const TOKEN = 'opaque-token';
const SCOPE = 'tenant-scope';
const deriveScopeKey = token => {
  assert.equal(token, TOKEN);
  return SCOPE;
};

const makeStorage = () => {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
    raw(key) { return values.get(key); },
  };
};

test('poll claim key is tenant and job scoped', () => {
  const key = getCalculationJobPollClaimStorageKey(TOKEN, JOB_ID, { deriveScopeKey });
  assert.match(key, /tenant-scope/);
  assert.match(key, /job_abcdefghijklmnopqrstuv/);
  assert.throws(
    () => getCalculationJobPollClaimStorageKey(TOKEN, 'bad-job', { deriveScopeKey }),
    /valid calculation job ID/,
  );
});

test('one tab claims a poll and the same job is throttled for the minimum interval', async () => {
  const storage = makeStorage();
  let currentTime = 10_000;
  let randomIndex = 0;

  const first = await claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: 5_000,
    now: () => currentTime,
    delay: async () => {},
    randomId: () => `claim-${++randomIndex}`,
    deriveScopeKey,
  });
  assert.equal(first, true);

  currentTime = 14_999;
  const blocked = await claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: 5_000,
    now: () => currentTime,
    delay: async () => {},
    randomId: () => `claim-${++randomIndex}`,
    deriveScopeKey,
  });
  assert.equal(blocked, false);

  currentTime = 15_000;
  const nextWindow = await claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: 5_000,
    now: () => currentTime,
    delay: async () => {},
    randomId: () => `claim-${++randomIndex}`,
    deriveScopeKey,
  });
  assert.equal(nextWindow, true);
});

test('settle confirmation permits at most one winner when two tabs observed an available window', async () => {
  const values = new Map();
  let staleReadsRemaining = 2;
  const storage = {
    getItem(key) {
      // Model separate browsing contexts that both observed the pre-claim state
      // before either write became visible to the other context.
      if (staleReadsRemaining > 0) {
        staleReadsRemaining -= 1;
        return null;
      }
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) { values.set(key, String(value)); },
  };

  const settles = [];
  const delay = () => new Promise(resolve => settles.push(resolve));
  const shared = {
    storage,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: 5_000,
    now: () => 20_000,
    delay,
    deriveScopeKey,
  };

  const firstPromise = claimCalculationJobPoll({ ...shared, randomId: () => 'claim-a' });
  const secondPromise = claimCalculationJobPoll({ ...shared, randomId: () => 'claim-b' });

  await Promise.resolve();
  assert.equal(settles.length, 2);
  for (const resolve of settles) resolve();

  const results = await Promise.all([firstPromise, secondPromise]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('malformed old claim can be replaced but storage/time/identity failures fail closed', async () => {
  const storage = makeStorage();
  const key = getCalculationJobPollClaimStorageKey(TOKEN, JOB_ID, { deriveScopeKey });
  storage.setItem(key, '{bad json');

  const replaced = await claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: 5_000,
    now: () => 30_000,
    delay: async () => {},
    randomId: () => 'replacement',
    deriveScopeKey,
  });
  assert.equal(replaced, true);

  assert.equal(await claimCalculationJobPoll({
    storage: null,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: 5_000,
    deriveScopeKey,
  }), false);
  assert.equal(await claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId: JOB_ID,
    minimumIntervalMs: CALCULATION_JOB_POLL_CLAIM_SETTLE_MS,
    deriveScopeKey,
  }), false);
  assert.equal(await claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId: 'bad-job',
    minimumIntervalMs: 5_000,
    deriveScopeKey,
  }), false);
});

test('terminal cleanup removes only the exact tenant/job poll claim', async () => {
  const storage = makeStorage();
  const otherJobId = 'job_ABCDEFGHIJKLMNOPQRSTUV';
  const claim = async jobId => claimCalculationJobPoll({
    storage,
    token: TOKEN,
    jobId,
    minimumIntervalMs: 5_000,
    now: () => 40_000,
    delay: async () => {},
    randomId: () => `claim-${jobId}`,
    deriveScopeKey,
  });

  assert.equal(await claim(JOB_ID), true);
  assert.equal(await claim(otherJobId), true);

  const currentKey = getCalculationJobPollClaimStorageKey(TOKEN, JOB_ID, { deriveScopeKey });
  const otherKey = getCalculationJobPollClaimStorageKey(TOKEN, otherJobId, { deriveScopeKey });
  assert.equal(storage.has(currentKey), true);
  assert.equal(storage.has(otherKey), true);

  assert.equal(clearCalculationJobPollClaim(storage, TOKEN, JOB_ID, { deriveScopeKey }), true);
  assert.equal(storage.has(currentKey), false);
  assert.equal(storage.has(otherKey), true);
});
