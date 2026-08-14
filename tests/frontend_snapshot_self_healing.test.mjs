import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSnapshotRepairTracker,
  reconcileSnapshotSelfHealing,
} from '../src/services/snapshotSelfHealing.js';
import {
  markAutomaticRecalculationDirty,
  readAutomaticRecalculationStatus,
} from '../src/services/automaticRecalculationState.js';
import { buildSourceRecordsIdentity } from '../src/services/snapshotIntegrity.js';

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
const RECORDS = Object.freeze([
  Object.freeze({
    id: 1,
    user_id: OWNER,
    txn_date: '2026-08-14',
    symbol: 'AAPL',
    txn_type: 'BUY',
    qty: 1,
    price: 100,
    fee: 0,
    tax: 0,
    tag: 'Stock',
    note: '',
  }),
]);

const makeSnapshot = async ({ price = 100, benchmark = 'SPY' } = {}) => {
  const records = RECORDS.map(record => ({ ...record, price }));
  const source = await buildSourceRecordsIdentity(records);
  return {
    updated_at: '2026-08-14T04:00:00Z',
    calculation_manifest: {
      deterministic_identity: {
        identity_version: 1,
        source_records: source,
        runtime_config: { benchmark_symbol: benchmark },
      },
    },
  };
};

const makeContext = async ({ snapshot, records = RECORDS, readStatus = 'loaded' } = {}) => {
  const storage = new MemoryStorage();
  const calls = { stale: 0, fetchAll: 0 };
  const portfolio = {
    portfolioReadStatus: readStatus,
    records,
    rawData: snapshot ?? await makeSnapshot(),
    selectedBenchmark: 'SPY',
    markSnapshotStale() {
      calls.stale += 1;
    },
    async fetchAll() {
      calls.fetchAll += 1;
      return true;
    },
  };
  const auth = { user: { email: OWNER } };
  return { storage, portfolio, auth, calls };
};

test('fresh cryptographic snapshot proof from Worker API records performs no repair handoff', async () => {
  const context = await makeContext();
  const result = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: createSnapshotRepairTracker(),
  });

  assert.equal(result.action, 'verified');
  assert.equal(context.calls.stale, 0);
  assert.equal(context.calls.fetchAll, 0);
  assert.equal(readAutomaticRecalculationStatus(context.storage, OWNER).dirty, false);
});

test('provably stale source creates one Phase 2 dirty generation and hands off through fetchAll', async () => {
  const staleSnapshot = await makeSnapshot({ price: 99 });
  const context = await makeContext({ snapshot: staleSnapshot });
  const tracker = createSnapshotRepairTracker();
  const result = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: tracker,
  });

  assert.equal(result.action, 'repair_handed_to_phase2');
  assert.equal(context.calls.stale, 1);
  assert.equal(context.calls.fetchAll, 1);
  const status = readAutomaticRecalculationStatus(context.storage, OWNER);
  assert.equal(status.dirty, true);
  assert.equal(status.generation.benchmark, 'SPY');
  assert.equal(tracker.has(result.assessment.fingerprint), true);
});

test('benchmark mismatch is a repairable lifecycle anomaly', async () => {
  const context = await makeContext({ snapshot: await makeSnapshot({ benchmark: 'QQQ' }) });
  const result = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: createSnapshotRepairTracker(),
  });

  assert.equal(result.action, 'repair_handed_to_phase2');
  assert.equal(result.assessment.status, 'stale_benchmark');
  assert.equal(context.calls.fetchAll, 1);
});

test('existing Phase 2 dirty generation is never replaced by snapshot repair', async () => {
  const context = await makeContext({ snapshot: await makeSnapshot({ price: 99 }) });
  const existing = markAutomaticRecalculationDirty(context.storage, OWNER, 'SPY');
  const result = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: createSnapshotRepairTracker(),
  });

  assert.equal(result.action, 'phase2_already_dirty');
  assert.equal(context.calls.fetchAll, 0);
  const status = readAutomaticRecalculationStatus(context.storage, OWNER);
  assert.equal(status.generation.token, existing.token);
});

test('same anomaly fingerprint is attempted at most once per installed tracker lifetime', async () => {
  const context = await makeContext({ snapshot: await makeSnapshot({ price: 99 }) });
  const tracker = createSnapshotRepairTracker();
  const first = await reconcileSnapshotSelfHealing({ ...context, attemptedFingerprints: tracker });
  assert.equal(first.action, 'repair_handed_to_phase2');

  context.storage.values.clear();
  const second = await reconcileSnapshotSelfHealing({ ...context, attemptedFingerprints: tracker });
  assert.equal(second.action, 'already_attempted');
  assert.equal(context.calls.fetchAll, 1);
});

test('malformed authoritative API records fail closed without creating repair state', async () => {
  const context = await makeContext({
    records: [{ ...RECORDS[0], qty: 'invalid' }],
  });
  const result = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: createSnapshotRepairTracker(),
  });

  assert.equal(result.action, 'fail_closed');
  assert.equal(context.calls.stale, 1);
  assert.equal(context.calls.fetchAll, 0);
  assert.equal(readAutomaticRecalculationStatus(context.storage, OWNER).dirty, false);
});

test('reconciliation never runs before a successful full portfolio read or without signed owner identity', async () => {
  const context = await makeContext({ readStatus: 'loading' });
  const notReady = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: createSnapshotRepairTracker(),
  });
  assert.equal(notReady.action, 'not_ready');

  context.portfolio.portfolioReadStatus = 'loaded';
  context.auth.user.email = '';
  const noOwner = await reconcileSnapshotSelfHealing({
    ...context,
    attemptedFingerprints: createSnapshotRepairTracker(),
  });
  assert.equal(noOwner.action, 'no_owner');
  assert.equal(context.calls.fetchAll, 0);
});
