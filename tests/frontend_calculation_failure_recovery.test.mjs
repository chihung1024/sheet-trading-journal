import assert from 'node:assert/strict';
import test from 'node:test';

import {
  claimAutomaticFailureRetry,
  clearCalculationFailureRecoveryState,
  FAILURE_RECOVERY_CLASS,
  readCalculationFailureRecoveryState,
  triageCalculationFailure,
} from '../src/services/calculationFailureRecovery.js';
import {
  CALCULATION_FAILURE_RECOVERY_STORAGE_KEY,
  clearSensitiveProjectStorage,
} from '../src/services/projectStorage.js';

const TOKEN_A = 'generation_token_1234567890';
const TOKEN_B = 'generation_token_0987654321';

const createStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
};

test('only allowlisted transient calculation failures are automatically retryable', () => {
  for (const errorCode of [
    'GITHUB_DISPATCH_TIMEOUT',
    'GITHUB_DISPATCH_FAILED',
    'RECORDS_API_FAILED',
    'SETTINGS_API_FAILED',
    'MARKET_DATA_FAILED',
    'SNAPSHOT_UPLOAD_FAILED',
  ]) {
    const triage = triageCalculationFailure({ errorCode });
    assert.equal(triage.classification, FAILURE_RECOVERY_CLASS.RETRYABLE_TRANSIENT);
    assert.equal(triage.retryable, true);
    assert.equal(triage.errorCode, errorCode);
  }
});

test('ambiguous idempotent trigger outcome is retryable without broadening unknown job failures', () => {
  const ambiguous = triageCalculationFailure({
    errorCode: '',
    source: 'trigger',
    outcomeAmbiguous: true,
  });
  assert.equal(ambiguous.classification, FAILURE_RECOVERY_CLASS.RETRYABLE_TRANSIENT);
  assert.equal(ambiguous.retryable, true);
  assert.equal(ambiguous.reason, 'idempotent_trigger_outcome_ambiguous');

  const unknownJob = triageCalculationFailure({
    errorCode: 'SOMETHING_NEW',
    source: 'job',
  });
  assert.equal(unknownJob.classification, FAILURE_RECOVERY_CLASS.UNKNOWN_STOP);
  assert.equal(unknownJob.retryable, false);
});

test('validation, financial integrity, configuration, and generic failures fail closed', () => {
  const cases = [
    ['RECORD_VALIDATION_FAILED', FAILURE_RECOVERY_CLASS.USER_ACTION_REQUIRED],
    ['RECONCILIATION_FAILED', FAILURE_RECOVERY_CLASS.INTEGRITY_STOP],
    ['SNAPSHOT_VALIDATION_FAILED', FAILURE_RECOVERY_CLASS.INTEGRITY_STOP],
    ['CONFIGURATION_FAILED', FAILURE_RECOVERY_CLASS.OPERATIONS_STOP],
    ['CALCULATION_FAILED', FAILURE_RECOVERY_CLASS.UNKNOWN_STOP],
    ['MULTIPLE_USER_FAILURES', FAILURE_RECOVERY_CLASS.UNKNOWN_STOP],
    ['UNKNOWN_CALCULATION_FAILED', FAILURE_RECOVERY_CLASS.UNKNOWN_STOP],
  ];

  for (const [errorCode, classification] of cases) {
    const triage = triageCalculationFailure({ errorCode });
    assert.equal(triage.classification, classification);
    assert.equal(triage.retryable, false);
  }
});

test('automatic recovery is durably bounded to one retry per dirty generation', () => {
  const storage = createStorage();
  const triage = triageCalculationFailure({ errorCode: 'MARKET_DATA_FAILED' });

  assert.equal(claimAutomaticFailureRetry(
    storage,
    ' User@Example.com ',
    TOKEN_A,
    triage,
    { now: 1_700_000_000_000 },
  ), true);

  assert.deepEqual(readCalculationFailureRecoveryState(
    storage,
    'user@example.com',
    { now: 1_700_000_000_100 },
  ), {
    version: 1,
    owner: 'user@example.com',
    generationToken: TOKEN_A,
    attempts: 1,
    lastErrorCode: 'MARKET_DATA_FAILED',
    claimedAt: 1_700_000_000_000,
  });

  assert.equal(claimAutomaticFailureRetry(
    storage,
    'user@example.com',
    TOKEN_A,
    triage,
    { now: 1_700_000_000_200 },
  ), false);

  assert.equal(claimAutomaticFailureRetry(
    storage,
    'user@example.com',
    TOKEN_B,
    triage,
    { now: 1_700_000_000_300 },
  ), true);
  assert.equal(
    readCalculationFailureRecoveryState(storage, 'user@example.com', { now: 1_700_000_000_400 }).generationToken,
    TOKEN_B,
  );
});

test('non-retryable triage and invalid owner/token never create recovery state', () => {
  const storage = createStorage();
  const blocked = triageCalculationFailure({ errorCode: 'RECONCILIATION_FAILED' });
  const retryable = triageCalculationFailure({ errorCode: 'RECORDS_API_FAILED' });

  assert.equal(claimAutomaticFailureRetry(storage, 'user@example.com', TOKEN_A, blocked), false);
  assert.equal(claimAutomaticFailureRetry(storage, '', TOKEN_A, retryable), false);
  assert.equal(claimAutomaticFailureRetry(storage, 'user@example.com', 'short', retryable), false);
  assert.equal(storage.getItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY), null);
});

test('recovery state is owner isolated and clear can be generation scoped', () => {
  const storage = createStorage();
  const triage = triageCalculationFailure({ errorCode: 'SNAPSHOT_UPLOAD_FAILED' });
  assert.equal(claimAutomaticFailureRetry(storage, 'owner@example.com', TOKEN_A, triage), true);

  assert.equal(readCalculationFailureRecoveryState(storage, 'other@example.com'), null);
  assert.equal(clearCalculationFailureRecoveryState(
    storage,
    'owner@example.com',
    { generationToken: TOKEN_B },
  ), false);
  assert.notEqual(storage.getItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY), null);
  assert.equal(clearCalculationFailureRecoveryState(
    storage,
    'owner@example.com',
    { generationToken: TOKEN_A },
  ), true);
  assert.equal(storage.getItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY), null);
});

test('malformed recovery state fails closed and logout cleanup removes the fixed key', () => {
  const storage = createStorage({
    [CALCULATION_FAILURE_RECOVERY_STORAGE_KEY]: '{bad-json',
    unrelated: 'preserve-me',
  });
  assert.equal(readCalculationFailureRecoveryState(storage, 'user@example.com'), null);

  const removed = clearSensitiveProjectStorage(storage);
  assert.equal(removed.includes(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY), true);
  assert.equal(storage.getItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'preserve-me');
});
