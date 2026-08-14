import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearAutomaticRecalculationState,
  markAutomaticRecalculationCoverage,
  markAutomaticRecalculationDirty,
  readAutomaticRecalculationStatus,
  settleAutomaticRecalculationJob,
} from '../src/services/automaticRecalculationState.js';
import {
  AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY,
  AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX,
  AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY,
  clearSensitiveProjectStorage,
} from '../src/services/projectStorage.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

const OWNER = 'user@example.com';
const OTHER = 'other@example.com';
const NOW = Date.UTC(2026, 7, 14, 3, 0, 0);
const JOB_1 = 'job_ABCDEFGHIJKLMNOPQRSTUV';
const JOB_2 = 'job_ZYXWVUTSRQPONMLKJIHGFE';
const tokens = (...values) => {
  let index = 0;
  return () => values[index++];
};

test('committed mutation creates an owner-bound durable dirty generation', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER.toUpperCase(), 'spy', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });

  assert.equal(generation.owner, OWNER);
  assert.equal(generation.benchmark, 'SPY');
  assert.equal(generation.token, 'dirty-generation-0001');
  const status = readAutomaticRecalculationStatus(storage, OWNER, { now: NOW });
  assert.equal(status.dirty, true);
  assert.equal(status.generation.token, generation.token);
  assert.equal(storage.getItem(AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY)?.includes(OWNER), true);
});

test('a newly created calculation job can cover and clean the exact captured generation', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });

  assert.equal(markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_1,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 1 }), true);

  const settled = settleAutomaticRecalculationJob(storage, OWNER, JOB_1, {
    succeeded: true,
    now: NOW + 2,
  });
  assert.equal(settled.dirty, false);
  const clean = JSON.parse(storage.getItem(AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY));
  assert.equal(clean.token, generation.token);
  assert.equal(storage.getItem(`${AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX}${JOB_1}`), null);
});

test('current benchmark job may cover an older dirty token created under a different benchmark', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });

  assert.equal(markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_1,
    benchmark: 'QQQ',
    deduplicated: false,
  }, { now: NOW + 1 }), true);

  const coverage = JSON.parse(
    storage.getItem(`${AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX}${JOB_1}`),
  );
  assert.equal(coverage.benchmark, 'QQQ');
  assert.equal(settleAutomaticRecalculationJob(storage, OWNER, JOB_1, {
    succeeded: true,
    now: NOW + 2,
  }).dirty, false);
  const clean = JSON.parse(storage.getItem(AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY));
  assert.equal(clean.token, generation.token);
  assert.equal(clean.benchmark, 'QQQ');
});

test('mutation during a running job remains dirty after the older covered job succeeds', () => {
  const storage = new MemoryStorage();
  const first = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });
  markAutomaticRecalculationCoverage(storage, OWNER, first, {
    id: JOB_1,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 1 });

  const second = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW + 2,
    createToken: tokens('dirty-generation-0002'),
  });
  const settled = settleAutomaticRecalculationJob(storage, OWNER, JOB_1, {
    succeeded: true,
    now: NOW + 3,
  });

  assert.equal(settled.dirty, true);
  assert.equal(settled.generation.token, second.token);
  assert.notEqual(settled.generation.token, first.token);
});

test('deduplicated active job is never allowed to claim a later dirty generation', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });

  assert.equal(markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_1,
    benchmark: 'SPY',
    deduplicated: true,
  }, { now: NOW + 1 }), false);
  const settled = settleAutomaticRecalculationJob(storage, OWNER, JOB_1, {
    succeeded: true,
    now: NOW + 2,
  });
  assert.equal(settled.dirty, true);
  assert.equal(settled.generation.token, generation.token);
});

test('failed covered job releases coverage but never marks the dirty generation clean', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });
  markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_1,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 1 });

  const settled = settleAutomaticRecalculationJob(storage, OWNER, JOB_1, {
    succeeded: false,
    now: NOW + 2,
  });
  assert.equal(settled.dirty, true);
  assert.equal(storage.getItem(AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY), null);
  assert.equal(storage.getItem(`${AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX}${JOB_1}`), null);
});

test('a later new job may cover the still-dirty generation after an earlier failure', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });
  markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_1,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 1 });
  settleAutomaticRecalculationJob(storage, OWNER, JOB_1, { succeeded: false, now: NOW + 2 });

  assert.equal(markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_2,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 3 }), true);
  assert.equal(settleAutomaticRecalculationJob(storage, OWNER, JOB_2, {
    succeeded: true,
    now: NOW + 4,
  }).dirty, false);
});

test('owner isolation prevents another tenant from observing or clearing dirty state', () => {
  const storage = new MemoryStorage();
  markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });

  assert.equal(readAutomaticRecalculationStatus(storage, OTHER, { now: NOW }).dirty, false);
  assert.equal(clearAutomaticRecalculationState(storage, OTHER), 0);
  assert.equal(readAutomaticRecalculationStatus(storage, OWNER, { now: NOW }).dirty, true);
});

test('explicit state clear and logout cleanup remove automatic recalculation recovery keys', () => {
  const storage = new MemoryStorage();
  const generation = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW,
    createToken: tokens('dirty-generation-0001'),
  });
  markAutomaticRecalculationCoverage(storage, OWNER, generation, {
    id: JOB_1,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 1 });

  assert.equal(clearAutomaticRecalculationState(storage, OWNER) >= 2, true);
  assert.equal(readAutomaticRecalculationStatus(storage, OWNER, { now: NOW + 2 }).dirty, false);

  const next = markAutomaticRecalculationDirty(storage, OWNER, 'SPY', {
    now: NOW + 3,
    createToken: tokens('dirty-generation-0002'),
  });
  markAutomaticRecalculationCoverage(storage, OWNER, next, {
    id: JOB_2,
    benchmark: 'SPY',
    deduplicated: false,
  }, { now: NOW + 4 });
  clearSensitiveProjectStorage(storage);
  assert.equal(storage.getItem(AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY), null);
  assert.equal(storage.getItem(AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY), null);
  assert.equal(storage.getItem(`${AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX}${JOB_2}`), null);
});
