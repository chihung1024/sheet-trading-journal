import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CALCULATION_REQUEST_STORAGE_KEY,
  clearPendingCalculationRequest,
  isTerminalCalculationStatus,
  normalizeCalculationOwner,
  readPendingCalculationRequest,
  rememberPendingCalculationRequest,
  validatePendingCalculationRequest,
} from '../src/services/calculationJobState.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let removeCount = 0;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) {
      removeCount += 1;
      values.delete(key);
    },
    has(key) { return values.has(key); },
    removeCount() { return removeCount; },
  };
}

const NOW = 1_800_000_000_000;
const valid = {
  owner: 'user@example.com',
  key: 'abcdefghijklmnop',
  createdAt: NOW - 1_000,
  jobId: 'job_abcdefghijklmnopqrstuv',
};

test('normalizes owner identity without touching opaque job values', () => {
  assert.equal(normalizeCalculationOwner('  User@Example.COM '), 'user@example.com');
  assert.equal(normalizeCalculationOwner(null), '');
});

test('accepts valid same-owner pending state', () => {
  assert.deepEqual(
    validatePendingCalculationRequest(valid, ' USER@example.com ', { now: NOW }),
    valid,
  );
});

test('rejects malformed, expired, future, and cross-owner state', () => {
  assert.equal(validatePendingCalculationRequest({ ...valid, key: 'short' }, valid.owner, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, jobId: 'job_invalid' }, valid.owner, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, createdAt: NOW - 15 * 60 * 1000 }, valid.owner, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest({ ...valid, createdAt: NOW + 60_001 }, valid.owner, { now: NOW }), null);
  assert.equal(validatePendingCalculationRequest(valid, 'other@example.com', { now: NOW }), null);
});

test('read fails closed without mutating invalid or cross-owner persistence', () => {
  const storage = createStorage({
    [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(valid),
  });
  assert.equal(readPendingCalculationRequest(storage, 'other@example.com', { now: NOW }), null);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), true);
  assert.equal(storage.removeCount(), 0);

  storage.setItem(CALCULATION_REQUEST_STORAGE_KEY, '{bad json');
  assert.equal(readPendingCalculationRequest(storage, valid.owner, { now: NOW }), null);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), true);
  assert.equal(storage.removeCount(), 0);
});

test('read accepts a read-only Storage surface and never requires removeItem', () => {
  const raw = JSON.stringify(valid);
  const readOnlyStorage = {
    getItem(key) {
      return key === CALCULATION_REQUEST_STORAGE_KEY ? raw : null;
    },
  };

  assert.deepEqual(
    readPendingCalculationRequest(readOnlyStorage, valid.owner, { now: NOW }),
    valid,
  );
});

test('a stale read cannot destructively clear a newer sibling-tab write', () => {
  const staleRaw = JSON.stringify({
    ...valid,
    createdAt: NOW - 15 * 60 * 1000,
  });
  const fresh = {
    ...valid,
    key: 'qrstuvwxyzABCDEF',
    createdAt: NOW,
    jobId: null,
  };
  let raw = staleRaw;
  let writes = 0;
  let removals = 0;

  const storage = {
    getItem() {
      const observed = raw;
      // Model another tab publishing a fresh request after this reader observed
      // the stale value but before this read returns to its caller.
      raw = JSON.stringify(fresh);
      writes += 1;
      return observed;
    },
    removeItem() {
      removals += 1;
      raw = null;
    },
  };

  assert.equal(readPendingCalculationRequest(storage, valid.owner, { now: NOW }), null);
  assert.equal(writes, 1);
  assert.equal(removals, 0);
  assert.deepEqual(JSON.parse(raw), fresh);
});

test('remember persists only normalized tenant-bound state', () => {
  const storage = createStorage();
  const result = rememberPendingCalculationRequest(storage, ' User@Example.COM ', {
    key: valid.key,
    createdAt: NOW,
    jobId: null,
  });
  assert.deepEqual(result, {
    owner: valid.owner,
    key: valid.key,
    createdAt: NOW,
    jobId: null,
  });
  const raw = JSON.parse(storage.getItem(CALCULATION_REQUEST_STORAGE_KEY));
  assert.equal(raw.owner, valid.owner);
  assert.equal(Object.hasOwn(raw, 'token'), false);
  assert.equal(Object.hasOwn(raw, 'apiKey'), false);
  assert.equal(Object.hasOwn(raw, 'targetUser'), false);
});

test('terminal statuses and cleanup are explicit', () => {
  assert.equal(isTerminalCalculationStatus('succeeded'), true);
  assert.equal(isTerminalCalculationStatus('failed'), true);
  assert.equal(isTerminalCalculationStatus('queued'), false);
  assert.equal(isTerminalCalculationStatus('running'), false);

  const storage = createStorage({ [CALCULATION_REQUEST_STORAGE_KEY]: '{}' });
  clearPendingCalculationRequest(storage);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), false);
  assert.equal(storage.removeCount(), 1);
});
