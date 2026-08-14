import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessSnapshotIntegrity,
  buildSourceRecordsIdentity,
  pythonFloatHex,
  SNAPSHOT_INTEGRITY_STATUS,
} from '../src/services/snapshotIntegrity.js';

const RECORDS = Object.freeze([
  Object.freeze({
    id: 2,
    Date: '2026-08-14',
    Symbol: 'aapl',
    Type: 'buy',
    Qty: 1.5,
    Price: 100.25,
    Commission: 0.1,
    Tax: 0,
    Tag: ' Stock ',
  }),
  Object.freeze({
    id: 1,
    Date: '2026-08-13',
    Symbol: 'TSM',
    Type: 'SELL',
    Qty: 2,
    Price: 200,
    Commission: 0,
    Tax: 1.25,
    Tag: '',
  }),
]);

const snapshotFor = (identity, benchmark = 'SPY') => ({
  updated_at: '2026-08-14T03:30:00Z',
  calculation_manifest: {
    manifest_version: 1,
    deterministic_identity: {
      identity_version: 1,
      source_records: identity,
      runtime_config: {
        canonicalization_version: 1,
        benchmark_symbol: benchmark,
        base_currency: 'TWD',
        oversell_policy: 'CLAMP',
        auto_adjust_splits: true,
      },
    },
  },
});

test('float canonicalization matches Python float.hex for IEEE-754 edge fixtures', () => {
  assert.equal(pythonFloatHex(0), '0x0.0p+0');
  assert.equal(pythonFloatHex(-0), '-0x0.0p+0');
  assert.equal(pythonFloatHex(1), '0x1.0000000000000p+0');
  assert.equal(pythonFloatHex(0.1), '0x1.999999999999ap-4');
  assert.equal(pythonFloatHex(100.25), '0x1.9100000000000p+6');
  assert.equal(pythonFloatHex(Number.MIN_VALUE), '0x0.0000000000001p-1022');
  assert.equal(pythonFloatHex(Number.MAX_VALUE), '0x1.fffffffffffffp+1023');
});

test('source identity is deterministic across input order and normalizes symbol/type exactly like engine contract', async () => {
  const first = await buildSourceRecordsIdentity(RECORDS);
  const second = await buildSourceRecordsIdentity([...RECORDS].reverse());
  const normalized = await buildSourceRecordsIdentity(RECORDS.map(record => ({
    ...record,
    Symbol: `  ${record.Symbol.toUpperCase()}  `,
    Type: ` ${record.Type.toUpperCase()} `,
  })));

  assert.deepEqual(first, second);
  assert.deepEqual(first, normalized);
  assert.match(first.sha256, /^[0-9a-f]{64}$/);
  assert.equal(first.record_count, 2);
  assert.equal(first.max_record_id, 2);
});

test('exact source identity and benchmark classify snapshot as fresh', async () => {
  const identity = await buildSourceRecordsIdentity(RECORDS);
  const result = await assessSnapshotIntegrity(RECORDS, snapshotFor(identity), {
    expectedBenchmark: 'spy',
  });

  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.FRESH);
  assert.equal(result.repairNeeded, false);
  assert.equal(result.currentSource.sha256, identity.sha256);
});

test('records with no materialized snapshot are provably repairable', async () => {
  const result = await assessSnapshotIntegrity(RECORDS, { updated_at: '' }, {
    expectedBenchmark: 'SPY',
  });
  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.MISSING);
  assert.equal(result.repairNeeded, true);
  assert.match(result.fingerprint, /^missing\|/);
});

test('source mismatch catches edits even when record count and max id are unchanged', async () => {
  const identity = await buildSourceRecordsIdentity(RECORDS);
  const edited = RECORDS.map(record => (
    record.id === 1 ? { ...record, Price: record.Price + 1 } : record
  ));
  const result = await assessSnapshotIntegrity(edited, snapshotFor(identity), {
    expectedBenchmark: 'SPY',
  });

  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.STALE_SOURCE);
  assert.equal(result.repairNeeded, true);
  assert.equal(result.currentSource.record_count, identity.record_count);
  assert.equal(result.currentSource.max_record_id, identity.max_record_id);
  assert.notEqual(result.currentSource.sha256, identity.sha256);
});

test('current user benchmark mismatch is repairable without pretending source records are stale', async () => {
  const identity = await buildSourceRecordsIdentity(RECORDS);
  const result = await assessSnapshotIntegrity(RECORDS, snapshotFor(identity, 'SPY'), {
    expectedBenchmark: 'QQQ',
  });

  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.STALE_BENCHMARK);
  assert.equal(result.repairNeeded, true);
  assert.equal(result.manifestBenchmark, 'SPY');
  assert.equal(result.expectedBenchmark, 'QQQ');
  assert.equal(result.currentSource.sha256, identity.sha256);
});

test('missing or malformed current-engine manifest is repairable but malformed records fail closed without auto repair', async () => {
  const missingManifest = await assessSnapshotIntegrity(RECORDS, {
    updated_at: '2026-08-14T03:30:00Z',
    holdings: [],
  }, { expectedBenchmark: 'SPY' });
  assert.equal(missingManifest.status, SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_MANIFEST);
  assert.equal(missingManifest.repairNeeded, true);

  const malformedRecords = await assessSnapshotIntegrity([
    { ...RECORDS[0], Qty: 'not-a-number' },
  ], { updated_at: '2026-08-14T03:30:00Z' }, { expectedBenchmark: 'SPY' });
  assert.equal(malformedRecords.status, SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_RECORDS);
  assert.equal(malformedRecords.repairNeeded, false);
});

test('empty authoritative record set needs no calculation repair', async () => {
  const result = await assessSnapshotIntegrity([], { updated_at: '' }, {
    expectedBenchmark: 'SPY',
  });
  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.EMPTY);
  assert.equal(result.repairNeeded, false);
});
