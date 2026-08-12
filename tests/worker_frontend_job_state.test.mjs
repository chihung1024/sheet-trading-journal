import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
const persistentValid = {
  ...valid,
  lifecyclePersistent: true,
};

test('normalizes owner and benchmark identity without touching opaque job values', () => {
  assert.equal(normalizeCalculationOwner('  User@Example.COM '), OWNER);
  assert.equal(normalizeCalculationOwner(null), '');
  assert.equal(normalizeCalculationBenchmark(' 0050.tw '), '0050.TW');
  assert.equal(normalizeCalculationBenchmark(null), '');
});

test('benchmark matching preserves legacy compatibility but separates new explicit intents', () => {
  assert.equal(pendingCalculationMatchesBenchmark({ ...persistentValid, benchmark: 'SPY' }, ' spy '), true);
  assert.equal(pendingCalculationMatchesBenchmark({ ...persistentValid, benchmark: 'SPY' }, 'QQQ'), false);
  assert.equal(pendingCalculationMatchesBenchmark(valid, 'QQQ'), true);
  assert.equal(pendingCalculationMatchesBenchmark(null, 'SPY'), false);
  assert.equal(pendingCalculationMatchesBenchmark(valid, ''), false);
});

test('accepts current legacy and lifecycle-persistent same-owner pending state', () => {
  assert.deepEqual(
    validatePendingCalculationRequest(valid, ' USER@example.com ', { now: NOW }),
    valid,
  );
  assert.deepEqual(
    validatePendingCalculationRequest(
      { ...persistentValid, benchmark: ' 0050.tw ' },
      OWNER,
      { now: NOW },
    ),
    { ...persistentValid, benchmark: '0050.TW' },
  );
});

test('rejects malformed, future, and cross-owner state', () => {
  assert.equal(validatePendingCalculationRequest({ ...valid, key: 'short' }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, jobId: 'job_invalid' }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, createdAt: NOW + 60_001 }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, benchmark: '   ' }, OWNER, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest(valid, 'other@example.com', { now: NOW }), null);
});

test('only lifecycle-persistent state survives beyond the historical TTL', () => {
  const oldCreatedAt = NOW - CALCULATION_REQUEST_TTL_MS - 1;
  const unmarked = { ...valid, createdAt: oldCreatedAt };
  const durable = { ...unmarked, lifecyclePersistent: true };

  assert.equal(validatePendingCalculationRequest(unmarked, OWNER, { now: NOW }), null);
  assert.deepEqual(validatePendingCalculationRequest(durable, OWNER, { now: NOW }), durable);
  assert.deepEqual(
    validatePendingCalculationRequest({ ...durable, jobId: null, benchmark: 'SPY' }, OWNER, { now: NOW }),
    { ...durable, jobId: null, benchmark: 'SPY' },
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

test('first remember creates lifecycle-persistent v2 live generation and compatibility mirror', () => {
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
    lifecyclePersistent: true,
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

test('currently-valid pre-E1c-B state upgrades in place without rotating identity', () => {
  const legacy = {
    owner: OWNER,
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: OLD_JOB,
  };
  const storage = createStorage({
    [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(legacy),
  });

  const readable = readPendingCalculationRequest(storage, OWNER, { now: NOW });
  assert.deepEqual(readable, legacy);
  const upgraded = rememberPendingCalculationRequest(storage, OWNER, readable);

  assert.deepEqual(upgraded, { ...legacy, lifecyclePersistent: true });
  assert.equal(upgraded.key, legacy.key);
  assert.equal(upgraded.createdAt, legacy.createdAt);
  assert.equal(upgraded.jobId, legacy.jobId);
  assert.deepEqual(
    readPendingCalculationRequest(storage, OWNER, { now: NOW + CALCULATION_REQUEST_TTL_MS * 4 }),
    upgraded,
  );
});

test('second remember for the same key reuses timestamp, job identity, and benchmark intent', () => {
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
  assert.equal(updated.lifecyclePersistent, true);
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

test('ambiguous pre-job replay keeps the same benchmark-scoped generation beyond historical TTL', () => {
  const storage = createStorage();
  const first = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - CALCULATION_REQUEST_TTL_MS - 10_000,
    jobId: null,
    benchmark: 'SPY',
  });
  assert.equal(first.lifecyclePersistent, true);
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
  assert.equal(replay.lifecyclePersistent, true);
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

test('clearing an old exact job adds a durable tombstone and cannot disturb newer generation', () => {
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
  assert.equal(oldTombstone.lifecyclePersistent, true);
  assert.equal(oldTombstone.clearedAt, NOW);
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), newer);
});

test('legacy unmarked tombstone remains authoritative after historical TTL', () => {
  const storage = createStorage();
  const pending = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - 10_000,
    jobId: OLD_JOB,
  });
  const tombstone = {
    version: 2,
    state: 'cleared',
    owner: OWNER,
    key: pending.key,
    createdAt: pending.createdAt,
    jobId: pending.jobId,
    clearedAt: NOW - 5_000,
  };
  storage.setItem(getPendingCalculationTombstoneStorageKey(pending), JSON.stringify(tombstone));

  assert.equal(
    readPendingCalculationRequest(storage, OWNER, { now: NOW + CALCULATION_REQUEST_TTL_MS * 4 }),
    null,
  );
});

test('newer tombstone forms a generation watermark so older live state and mirror cannot resurrect', () => {
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
  assert.equal(
    readPendingCalculationRequest(storage, OWNER, { now: NOW + CALCULATION_REQUEST_TTL_MS * 4 }),
    null,
  );
});

test('legacy-only state remains readable and exact clear creates v2 tombstone without deleting fixed pointer', () => {
  const storage = createStorage({
    [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(valid),
  });
  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), valid);

  assert.equal(clearPendingCalculationRequest(storage, OWNER, { jobId: OLD_JOB }, { now: NOW }), 1);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), true);
  assert.equal(storage.removeCount(), 0);
  assert.equal(readPendingCalculationRequest(storage, OWNER, { now: NOW }), null);

  const tombstoneKey = getPendingCalculationTombstoneStorageKey(valid);
  const tombstone = JSON.parse(storage.raw(tombstoneKey));
  assert.equal(tombstone.lifecyclePersistent, true);
  assert.equal(tombstone.clearedAt, NOW);
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
  assert.equal(
    readPendingCalculationRequest(storage, OWNER, { now: NOW + CALCULATION_REQUEST_TTL_MS * 4 }),
    null,
  );
  assert.throws(
    () => rememberPendingCalculationRequest(storage, OWNER, {
      key: OLD_KEY,
      createdAt: NOW - 1_000,
      jobId: OLD_JOB,
    }),
    /already cleared/,
  );
});

test('malformed and cross-owner v2 entries cannot override valid same-owner generation', () => {
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
    lifecyclePersistent: true,
    clearedAt: null,
  };
  storage.setItem(getPendingCalculationGenerationStorageKey(other), JSON.stringify(other));

  assert.deepEqual(readPendingCalculationRequest(storage, OWNER, { now: NOW }), expected);
});

test('expired pre-E1c-B v2 live generation and mirror do not resurrect', () => {
  const expired = {
    owner: OWNER,
    key: OLD_KEY,
    createdAt: NOW - CALCULATION_REQUEST_TTL_MS,
    jobId: OLD_JOB,
  };
  const expiredGeneration = {
    version: 2,
    state: 'live',
    ...expired,
    clearedAt: null,
  };
  const storage = createStorage({
    [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(expired),
    [getPendingCalculationGenerationStorageKey(expired)]: JSON.stringify(expiredGeneration),
  });

  assert.equal(readPendingCalculationRequest(storage, OWNER, { now: NOW }), null);
});

test('persistent v2 generation survives historical TTL boundary', () => {
  const storage = createStorage();
  const pending = rememberPendingCalculationRequest(storage, OWNER, {
    key: OLD_KEY,
    createdAt: NOW - CALCULATION_REQUEST_TTL_MS,
    jobId: OLD_JOB,
  });
  assert.equal(pending.lifecyclePersistent, true);
  assert.deepEqual(
    readPendingCalculationRequest(storage, OWNER, { now: NOW + CALCULATION_REQUEST_TTL_MS * 4 }),
    pending,
  );
});

test('portfolio resume best-effort upgrades readable pending state before job polling', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const resumePendingCalculationJob = () => {');
  const end = source.indexOf('\n    const performFetchAll = async () => {', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const resumeSource = source.slice(start, end);

  const rememberIndex = resumeSource.indexOf('rememberPendingCalculationRequest(pending)');
  const pollIndex = resumeSource.indexOf('startCalculationJobPolling(pending.jobId)');
  assert.notEqual(rememberIndex, -1);
  assert.notEqual(pollIndex, -1);
  assert.ok(rememberIndex < pollIndex);
  assert.match(resumeSource, /if \(!pending\) return;/);
  assert.match(resumeSource, /catch \(error\)/);
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
