import assert from 'node:assert/strict';
import fs from 'node:fs';
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

const receiptComponentSource = fs.readFileSync(
  new URL('../src/components/ImportReconciliationReceipt.vue', import.meta.url),
  'utf8',
);
const canonicalComponentSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralImportPreview.vue', import.meta.url),
  'utf8',
);
const mappedComponentSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralColumnMapping.vue', import.meta.url),
  'utf8',
);
const ibkrComponentSource = fs.readFileSync(
  new URL('../src/components/IbkrTradeImport.vue', import.meta.url),
  'utf8',
);

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

test('an active durable reconciliation window blocks replay across importer key formats', async () => {
  let reconciled = 0;
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => { reconciled += 1; },
    readPendingIntents: () => [{
      idempotencyKey: 'ibkr.4f7b4d39f2b7',
      reconcilingUntil: 2000,
    }],
    now: 1000,
  });

  assert.equal(reconciled, 1);
  assert.deepEqual(gate, {
    ready: false,
    reason: IMPORT_AMBIGUOUS_RETRY_REASON.RECONCILIATION_PENDING,
    reconciliation_degraded: false,
  });
});

test('exhausted ambiguous recovery cannot permanently deadlock an explicit stable-source retry', async () => {
  let reconciled = 0;
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => { reconciled += 1; },
    readPendingIntents: () => [{
      idempotencyKey: 'ibkr.4f7b4d39f2b7',
      reconcilingUntil: 999,
    }],
    now: 1000,
  });

  assert.equal(reconciled, 1);
  assert.deepEqual(gate, {
    ready: true,
    reason: null,
    reconciliation_degraded: false,
  });
});

test('a live intent with no active reconciliation window may be explicitly superseded after recovery is awaited', async () => {
  const gate = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => {},
    readPendingIntents: () => [{ idempotencyKey: 'stable-but-exhausted-recovery' }],
    now: 1000,
  });

  assert.deepEqual(gate, {
    ready: true,
    reason: null,
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

test('unreadable or malformed recovery state fails closed', async () => {
  const unreadable = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => {},
    readPendingIntents: () => { throw new Error('storage unavailable'); },
  });
  const malformed = await prepareAmbiguousImportRetry(ambiguousResult, {
    entries,
    owner: 'owner@example.com',
    reconcile: async () => {},
    readPendingIntents: () => ({ unexpected: true }),
  });

  assert.deepEqual(unreadable, {
    ready: false,
    reason: IMPORT_AMBIGUOUS_RETRY_REASON.RECOVERY_STATE_UNAVAILABLE,
    reconciliation_degraded: false,
  });
  assert.deepEqual(malformed, unreadable);
});

test('gate refuses replay without stable prepared entries or a finite clock', async () => {
  await assert.rejects(
    () => prepareAmbiguousImportRetry(ambiguousResult, {
      entries: [{ idempotencyKey: '' }],
      owner: 'owner@example.com',
      reconcile: async () => {},
      readPendingIntents: () => [],
    }),
    /stable entry idempotency keys/,
  );
  await assert.rejects(
    () => prepareAmbiguousImportRetry(ambiguousResult, {
      entries,
      owner: 'owner@example.com',
      reconcile: async () => {},
      readPendingIntents: () => [],
      now: Number.NaN,
    }),
    /finite reconciliation clock/,
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

test('shared receipt emits retry only behind the ambiguous retry candidate gate', () => {
  assert.match(receiptComponentSource, /isAmbiguousImportRetryCandidate\(props\.result\)/);
  assert.match(receiptComponentSource, /props\.retryAvailable/);
  assert.match(receiptComponentSource, /emit\('retry'\)/);
});

test('canonical UI invalidates result on profile edit and reconciles before stable-key replay', () => {
  assert.match(canonicalComponentSource, /@input="invalidateImportResult"/);
  assert.match(canonicalComponentSource, /:retry-available="canRetryAmbiguous"/);
  assert.match(canonicalComponentSource, /@retry="retryAmbiguousImport"/);
  assert.match(canonicalComponentSource, /prepareAmbiguousImportRetry\(priorResult/);
  assert.match(canonicalComponentSource, /reconcile:\s*\(\) => portfolioStore\.fetchAll\(\)/);
  assert.match(canonicalComponentSource, /await executePreparedImport\(prepared, owner\)/);
});

test('mapped and IBKR UIs preserve exact source identity and reuse the guarded retry gate', () => {
  assert.match(mappedComponentSource, /@input="invalidateImportResult"/);
  assert.match(mappedComponentSource, /:retry-available="canRetryAmbiguous"/);
  assert.match(mappedComponentSource, /@retry="retryAmbiguousImport"/);
  assert.match(mappedComponentSource, /prepared = await prepareCurrentImport\(\)/);
  assert.match(mappedComponentSource, /prepareAmbiguousImportRetry\(priorResult/);
  assert.match(mappedComponentSource, /reconcile:\s*\(\) => portfolioStore\.fetchAll\(\)/);
  assert.match(mappedComponentSource, /await executePreparedImport\(prepared, owner\)/);

  const markProfileStart = ibkrComponentSource.indexOf('const markProfileDirty =');
  const rebuildStart = ibkrComponentSource.indexOf('const rebuildPreview =');
  assert.ok(markProfileStart >= 0 && rebuildStart > markProfileStart);
  assert.match(ibkrComponentSource.slice(markProfileStart, rebuildStart), /result\.value = null/);
  assert.match(ibkrComponentSource, /:retry-available="canRetryAmbiguous"/);
  assert.match(ibkrComponentSource, /@retry="retryAmbiguousImport"/);
  assert.match(ibkrComponentSource, /const retryEntries = preview\.value\.entries/);
  assert.match(ibkrComponentSource, /prepareAmbiguousImportRetry\(priorResult/);
  assert.match(ibkrComponentSource, /reconcile:\s*\(\) => portfolioStore\.fetchAll\(\)/);
  assert.match(ibkrComponentSource, /await executeCurrentImport\(owner\)/);
});
