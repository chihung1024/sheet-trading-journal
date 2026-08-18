import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IMPORT_AMBIGUOUS_RETRY_REASON,
  isAmbiguousImportRetryCandidate,
  prepareAmbiguousImportRetry,
} from '../src/services/importAmbiguousRetry.js';

const ambiguousResult = Object.freeze({
  status: 'partial_failure',
  failure: Object.freeze({ outcomeAmbiguous: true }),
});

const entries = Object.freeze([
  Object.freeze({ idempotencyKey: 'stable-key-0000001' }),
  Object.freeze({ idempotencyKey: 'stable-key-0000002' }),
]);

test('retry candidate is limited to ambiguous partial failures', () => {
  assert.equal(isAmbiguousImportRetryCandidate(ambiguousResult), true);
  assert.equal(isAmbiguousImportRetryCandidate({ status: 'partial_failure', failure: { outcomeAmbiguous: false } }), false);
  assert.equal(isAmbiguousImportRetryCandidate({ status: 'committed_with_sync_warning', failure: null }), false);
  assert.equal(isAmbiguousImportRetryCandidate({ status: 'failed', failure: { outcomeAmbiguous: true } }), false);
});

test('non-ambiguous result never invokes reconciliation', async () => {
  let reconciled = 0;
  const gate = await prepareAmbiguousImportRetry(
    { status: 'partial_failure', failure: { outcomeAmbiguous: false } },
    {
      entries,
      owner: 'owner@example.com',
      reconcile: async () => { reconciled += 1; },
      readPendingIntents: () => [],
    },
  );

  assert.deepEqual(gate, {
    ready: false,
    reason: IMPORT_AMBIGUOUS_RETRY_REASON.NOT_AMBIGUOUS,
    reconciliation_degraded: false,
  });
  assert.equal(reconciled, 0);
});

test('any remaining eligible create recovery blocks replay across importer key formats', async () => {
  let reconciled = 0;
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => { reconciled += 1; },
    readPendingIntents: () => [{ idempotencyKey: 'ibkr.4f7b4d39f2b7' }],
  });

  assert.equal(reconciled, 1);
  assert.deepEqual(gate, {
    ready: false,
    reason: IMPORT_AMBIGUOUS_RETRY_REASON.RECONCILIATION_PENDING,
    reconciliation_degraded: false,
  });
});

test('cleared pending state allows retry even when later readback degraded', async () => {
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => { throw new Error('later readback unavailable'); },
    readPendingIntents: () => [],
  });

  assert.deepEqual(gate, {
    ready: true,
    reason: null,
    reconciliation_degraded: true,
  });
});

test('unreadable recovery state fails closed', async () => {
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => {},
    readPendingIntents: () => { throw new Error('storage unavailable'); },
  });

  assert.deepEqual(gate, {
    ready: false,
    reason: IMPORT_AMBIGUOUS_RETRY_REASON.RECOVERY_STATE_UNAVAILABLE,
    reconciliation_degraded: false,
  });
});

test('gate refuses replay without stable prepared entries', async () => {
  await assert.rejects(
    () => prepareAmbiguousImportRetry(ambiguousResult, {
      entries: [{ idempotencyKey: '' }],
      owner: 'owner@example.com',
      reconcile: async () => {},
      readPendingIntents: () => [],
    }),
    /stable entry idempotency keys/,
  );
});

test('gate result never exposes entry keys or reconciliation error messages', async () => {
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => { throw new Error('private internal message'); },
    readPendingIntents: () => [],
  });

  const serialized = JSON.stringify(gate);
  assert.doesNotMatch(serialized, /stable-key|private internal message/);
});
