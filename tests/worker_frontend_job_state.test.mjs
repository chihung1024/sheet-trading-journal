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
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
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

test('read fails closed and removes invalid or cross-owner persistence', () => {
  const storage = createStorage({
    [CALCULATION_REQUEST_STORAGE_KEY]: JSON.stringify(valid),
  });
  assert.equal(readPendingCalculationRequest(storage, 'other@example.com', { now: NOW }), null);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), false);

  storage.setItem(CALCULATION_REQUEST_STORAGE_KEY, '{bad json');
  assert.equal(readPendingCalculationRequest(storage, valid.owner, { now: NOW }), null);
  assert.equal(storage.has(CALCULATION_REQUEST_STORAGE_KEY), false);
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
});
