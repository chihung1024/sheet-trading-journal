import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CALCULATION_REQUEST_STORAGE_KEY,
  CALCULATION_REQUEST_TTL_MS,
  clearPendingCalculationRequest,
  getPendingCalculationGenerationStorageKey,
  getPendingCalculationTombstoneStorageKey,
  isTerminalCalculationStatus,
  normalizeCalculationBenchmark,
  normalizeCalculationOwner,
  pendingCalculationMatchesBenchmark,
  readPendingCalculationRequest,
  rememberPendingCalculationRequest,
  validatePendingCalculationRequest,
} from '../src/services/calculationJobState.js';
import { PENDING_CALCULATION_V2_STORAGE_PREFIX } from '../src/services/projectStorage.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let removeCount = 0;
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) {
      removeCount += 1;
      values.delete(key);
    },
    has(key) { return values.has(key); },
    raw(key) { return values.get(key); },
    entries() { return [...values.entries()]; },
    removeCount() { return removeCount; },
  };
}

const NOW = 1_800_000_000_000;
const OWNER = 'user@example.com';
const OLD_KEY = 'abcdefghijklmnop';
const NEW_KEY = 'qrstuvwxyzABCDEF';
const OLD_JOB = 'job_abcdefghijklmnopqrstuv';
const NEW_JOB = 'job_ABCDEFGHIJKLMNOPQRSTUV';
const valid = {
  owner: OWNER,
  key: OLD_KEY,
  createdAt: NOW - 1_000,
  jobId: OLD_JOB,
};

test('normalizes owner and benchmark identity without touching opaque job values', () => {
  assert.equal(normalizeCalculationOwner('  User@Example.COM '), OWNER);
  assert.equal(normalizeCalculationOwner(null), '');
  assert.equal(normalizeCalculationBenchmark(' 0050.tw '), '0050.TW');
  assert.equal(normalizeCalculationBenchmark(null), '');
});

test('benchmark matching preserves legacy compatibility but separates new explicit intents', () => {
  assert.equal(pendingCalculationMatchesBenchmark({ ...valid, benchmark: 'SPY' }, ' spy '), true);
  assert.equal(pendingCalculationMatchesBenchmark({ ...valid, benchmark: 'SPY' }, 'QQQ'), false);
  assert.equal(pendingCalculationMatchesBenchmark(valid, 'QQQ'), true);
  assert.equal(pendingCalculationMatchesBenchmark(null, 'SPY'), false);
  assert.equal(pendingCalculationMatchesBenchmark(valid, ''), false);
});

test('accepts valid same-owner pending state', () => {
  assert.deepEqual(
    validatePendingCalculationRequest(valid, ' USER@example.com ', { now: NOW }),
    valid,
  );
  assert.deepEqual(
    validatePendingCalculationRequest({ ...valid, benchmark: ' 0050.tw ' }, OWNER, { now: NOW }),
    { ...valid, benchmark: '0050.TW' },
  );
});

test('rejects malformed, future, and cross-owner state without using age as liveness authority', () => {
  assert.equal(validatePendingCalculationRequest({ ...valid, key: 'short' }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, jobId: 'job_invalid' }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, createdAt: NOW + 60_001 }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, benchmark: '   ' }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest(valid, 'other@example.com', { now: NOW }), null);
});

test('age alone does not expire known-job or ambiguous pre-job recovery identity', () => {
  const muchLater = NOW + (7 * 24 * 60 * 60 * 1000);
  assert.deepEqual(
    validatePendingCalculationRequest(valid, OWNER, { now: muchLater }),
    valid,
  );
  assert.deepEqual(
    validatePendingCalculationRequest({ ...valid, jobId: null, benchmark: 'SPY' }, OWNER, { now: muchLater }),
    { ...valid, jobId: null, benchmark: 'SPY' },
  );
});

test('legacy read remains fail-closed and non-destructive on a non-enumerable Storage surface', () => {
  const values = new Map([[CALCULATION_REQUEST_STORAGE_KEY, JSON.stringify(valid)]]);
  let removals = 0;
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    removeItem(key) { removals += 1; values.delete(key); },
  };

  assert.equal(readPendingCalculationRequest(storage, 'other@example.com', { now: NOW }), null);
  assert.equal(removals, 0);
  assert.equal(values.has(CALCULATION_REQUEST_STORAGE_KEY), true);

  values.set(CALCULATION_REQUEST_STORAGE_KEY, '{bad json');
  assert.equal(readPendingCalculationRequest(storage, OWNER, { now: NOW }), null);
  assert.equal(removals, 0);
});

test('first remember creates v2 live generation and legacy compatibility mirror', () => {
  const storage = createStorage();
  const pending = rememberPendingCalculationRequest(storage, ' User@Example.COM ', {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: null,
    benchmark: ' spy ',
  });

  assert.deepEqual(pending, {
    owner: OWNER,
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: null,
    benchmark: 'SPY',
  });

  const generationKey = getPendingCalculationGenerationStorageKey(pending);
  assert.equal(generationKey.startsWith(`${PENDING_CALCULATION_V2_STORAGE_PREFIX}live.`), true);
  assert.deepEqual(JSON.parse(storage.raw(generationKey)), {
    version: 2,
    state: 'live',
    ...pending,
    clearedAt: null,
  });
  assert.deepEqual(JSON.parse(storage.raw(CALCULATION_REQUEST_STORAGE_KEY)), pending);
});

test('second remember for the same idempotency key reuses the original generation timestamp', () => {
  const storage = createStorage();
  const first = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: null,
    benchmark: 'SPY',
  });
  const updated = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 1_000,
    jobId: OLD_JOB,
    benchmark: 'spy',
  });

  assert.equal(updated.createdAt, first.createdAt);
  assert.equal(updated.jobId, OLD_JOB);
  assert.equal(updated.benchmark, 'SPY');
  assert.equal(
    storage.entries().filter(([key]) => key.startsWith(`${PENDING_CALCULATION_V2_STORAGE_PREFIX}live.`)).length,
    1,
  );
  assert.deepEqual(JSON.parse(storage.raw(CALCULATION_REQUEST_STORAGE_KEY)), updated);
});

test('same idempotency generation cannot be rebound to a different benchmark intent', () => {
  const storage = createStorage();
  rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: null,
    benchmark: 'SPY',
  });

  assert.throws(
    () => rememberPendingCalculationRequest(storage, OWNER, {
      key: OLD_KEY,
      createdAt: NOW,
      jobId: OLD_JOB,
      benchmark: 'QQQ',
    }),
    /benchmark intent conflicts/,
  );
});

test('ambiguous pre-job replay keeps the same benchmark-scoped generation beyond the historical TTL', () => {
  const storage = createStorage();
  const first = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - CALCULATION_REQUEST_TTL_MS - 10_000,
    jobId: null,
    benchmark: 'SPY',
  });
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), first);

  const replay = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW,
    jobId: null,
    benchmark: ' spy ',
  });
  assert.equal(replay.key, first.key);
  assert.equal(replay.createdAt, first.createdAt);
  assert.equal(replay.jobId, null);
  assert.equal(replay.benchmark, 'SPY');
});

test('newer generation coexists with older generation and is selected as authoritative', () => {
  const storage = createStorage();
  const old = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: OLD_JOB,
  });
  const newer = rememberPendingCalculationRequest(storage, OWNER, {
    key: NEW_KEY,
    createdAt: NOW - 1_000,
    jobId: NEW_JOB,
  });

  assert.equal(storage.has(getPendingCalculationGenerationStorageKey(old)), true);
  assert.equal(storage.has(getPendingCalculationGenerationStorageKey(newer)), true);
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), newer);
});

test('clearing an old exact job adds a separate tombstone and cannot disturb the newer generation', () => {
  const storage = createStorage();
  const old = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: OLD_JOB,
    benchmark: 'SPY',
  });
  const newer = rememberPendingCalculationRequest(storage, OWNER, {
    key: NEW_KEY,
    createdAt: NOW - 1_000,
    jobId: NEW_JOB,
    benchmark: 'QQQ',
  });

  assert.equal(clearPendingCalculationRequest(storage, OWNER, { jobId: OLD_JOB }, { now: NOW }), 1);
  const oldLive = JSON.parse(storage.raw(getPendingCalculationGenerationStorageKey(old)));
  const oldTombstone = JSON.parse(storage.raw(getPendingCalculationTombstoneStorageKey(old)));
  assert.equal(oldLive.state, 'live');
  assert.equal(oldLive.clearedAt, null);
  assert.equal(oldTombstone.state, 'cleared');
  assert.equal(oldTombstone.benchmark, 'SPY');
  assert.equal(oldTombstone.clearedAt, NOW);
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), newer);
});

test('newer tombstone forms a generation watermark so older live state and legacy mirror cannot resurrect', () => {
  const storage = createStorage();
  const old = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: OLD_JOB,
  });
  const newer = rememberPendingCalculationRequest(storage, OWNER, {
    key: NEW_KEY,
    createdAt: NOW - 1_000,
    jobId: NEW_JOB,
  });

  assert.equal(clearPendingCalculationRequest(storage, OWNER, { key: NEW_KEY }, { now: NOW }), 1);
  assert.equal(storage.has(getPendingCalculationGenerationStorageKey(old)), true);
  assert.equal(storage.has(getPendingCalculationGenerationStorageKey(newer)), true);
  assert.equal(storage.has(getPendingCalculationTombstoneStorageKey(newer)), true);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), true);
  assert.equal(readPendingCalculationRequest(storage, OWNER, { now: NOW }), null);
});

test('legacy-only state remains readable and exact clear creates a v2 tombstone without deleting the fixed pointer', () => {
  const storage = createStorage({
    [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(valid),
  });
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), valid);

  assert.equal(clearPendingCalculationRequest(storage, OWNER, { jobId: OLD_JOB }, { now: NOW }), 1);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), true);
  assert.equal(storage.removeCount(), 0);
  assert.equal(readPendingCalculationRequest(storage, OWNER, { now: NOW }), null);

  const tombstoneKey = getPendingCalculationTombstoneStorageKey(valid);
  assert.equal(JSON.parse(storage.raw(tombstoneKey)).clearedAt, NOW);
});

test('delayed live rewrite cannot erase an independent tombstone for the same generation', () => {
  const storage = createStorage();
  const pending = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: OLD_JOB,
  });
  clearPendingCalculationRequest(storage, OWNER, { key: OLD_KEY }, { now: NOW - 5_000 });

  const liveKey = getPendingCalculationGenerationStorageKey(pending);
  const delayedLive = JSON.parse(storage.raw(liveKey));
  delayedLive.jobId = OLD_JOB;
  storage.setItem(liveKey, JSON.stringify(delayedLive));

  assert.equal(storage.has(getPendingCalculationTombstoneStorageKey(pending)), true);
  assert.equal(readPendingCalculationRequest(storage, OWNER, { now: NOW }), null);
  assert.throws(
    () => rememberPendingCalculationRequest(storage, OWNER, {
      key: OLD_KEY,
      createdAt: NOW - 1_000,
      jobId: OLD_JOB,
    }),
    /already cleared/,
  );
});

test('malformed and cross-owner v2 entries cannot override a valid same-owner generation', () => {
  const storage = createStorage();
  const expected = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 2_000,
    jobId: OLD_JOB,
  });

  storage.setItem(`${PENDING_CALCULATION_V2_STORAGE_PREFIX}live.${NOW - 1_000}.${NEW_KEY}`, '{bad json');
  const other = {
    version: 2,
    state: 'live',
    owner: 'other@example.com',
    key: NEW_KEY,
    createdAt: NOW - 500,
    jobId: NEW_JOB,
    clearedAt: null,
  };
  storage.setItem(getPendingCalculationGenerationStorageKey(other), JSON.stringify(other));

  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), expected);
});

test('historical TTL boundary no longer makes a durable v2 generation disappear', () => {
  const storage = createStorage();
  const pending = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - CALCULATION_REQUEST_TTL_MS,
    jobId: OLD_JOB,
  });
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), pending);
});

test('terminal statuses remain explicit and unscoped cleanup is a no-op', () => {
  assert.equal(isTerminalCalculationStatus('succeeded'), true);
  assert.equal(isTerminalCalculationStatus('failed'), true);
  assert.equal(isTerminalCalculationStatus('queued'), false);
  assert.equal(isTerminalCalculationStatus('running'), false);

  const storage = createStorage({ [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(valid) });
  assert.equal(clearPendingCalculationRequest(storage), 0);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), true);
  assert.equal(storage.removeCount(), 0);
});
