import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessSnapshotIntegrity,
  buildSourceRecordsIdentity,
  buildSourceRecordsProjection,
  pythonFloatHex,
  SNAPSHOT_INTEGRITY_STATUS,
} from '../src/services/snapshotIntegrity.js';

const CALCULATION_RECORDS = Object.freeze([
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

const API_RECORDS = Object.freeze([
  Object.freeze({
    id: 2,
    user_id: 'user@example.com',
    txn_date: '2026-08-14',
    symbol: 'aapl',
    txn_type: 'buy',
    qty: 1.5,
    price: 100.25,
    fee: 0.1,
    tax: 0,
    tag: ' Stock ',
    note: 'ignored by manifest identity',
  }),
  Object.freeze({
    id: 1,
    user_id: 'user@example.com',
    txn_date: '2026-08-13',
    symbol: 'TSM',
    txn_type: 'SELL',
    qty: 2,
    price: 200,
    fee: 0,
    tax: 1.25,
    tag: '',
    note: '',
  }),
]);

const PYTHON_RECORDS_SHA256 = '87d3299660d98bc027a2ee16bcb3dbb246098b5c4e7ca6faf83fa9b3328fdaa4';

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

test('Worker API records project to the exact calculation manifest source contract', () => {
  assert.deepEqual(
    buildSourceRecordsProjection(API_RECORDS),
    buildSourceRecordsProjection(CALCULATION_RECORDS),
  );
});

test('Worker API and calculation-schema records produce the same Python canonical SHA', async () => {
  const apiIdentity = await buildSourceRecordsIdentity(API_RECORDS);
  const calculationIdentity = await buildSourceRecordsIdentity(CALCULATION_RECORDS);

  assert.deepEqual(apiIdentity, calculationIdentity);
  assert.equal(apiIdentity.sha256, PYTHON_RECORDS_SHA256);
  assert.equal(apiIdentity.record_count, 2);
  assert.equal(apiIdentity.max_record_id, 2);
});

test('API source identity is deterministic across order and ignores non-manifest API fields', async () => {
  const first = await buildSourceRecordsIdentity(API_RECORDS);
  const second = await buildSourceRecordsIdentity([...API_RECORDS].reverse());
  const changedNonManifestFields = await buildSourceRecordsIdentity(API_RECORDS.map(record => ({
    ...record,
    user_id: 'other@example.com',
    note: 'different note',
  })));

  assert.deepEqual(first, second);
  assert.deepEqual(first, changedNonManifestFields);
});

test('API symbol and type normalization preserves the existing trim and uppercase manifest contract', async () => {
  const normalized = await buildSourceRecordsIdentity(API_RECORDS);
  const padded = await buildSourceRecordsIdentity(API_RECORDS.map(record => ({
    ...record,
    symbol: `  ${record.symbol.toLowerCase()}  `,
    txn_type: ` ${record.txn_type.toLowerCase()} `,
  })));

  assert.deepEqual(normalized, padded);
});

test('API optional fee/tax/tag defaults match Python prepare_transactions normalization', async () => {
  const apiRecord = [{
    id: 1,
    txn_date: '2026-08-13',
    symbol: 'TSM',
    txn_type: 'BUY',
    qty: 2,
    price: 200,
  }];
  const calculationRecord = [{
    id: 1,
    Date: '2026-08-13',
    Symbol: 'TSM',
    Type: 'BUY',
    Qty: 2,
    Price: 200,
    Commission: 0,
    Tax: 0,
    Tag: '',
  }];

  assert.deepEqual(
    await buildSourceRecordsIdentity(apiRecord),
    await buildSourceRecordsIdentity(calculationRecord),
  );
});

test('exact Worker API source identity and benchmark classify snapshot as fresh', async () => {
  const identity = await buildSourceRecordsIdentity(CALCULATION_RECORDS);
  const result = await assessSnapshotIntegrity(API_RECORDS, snapshotFor(identity), {
    expectedBenchmark: 'spy',
  });

  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.FRESH);
  assert.equal(result.repairNeeded, false);
  assert.equal(result.currentSource.sha256, identity.sha256);
});

test('records with no materialized snapshot are provably repairable', async () => {
  const result = await assessSnapshotIntegrity(API_RECORDS, { updated_at: '' }, {
    expectedBenchmark: 'SPY',
  });
  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.MISSING);
  assert.equal(result.repairNeeded, true);
  assert.match(result.fingerprint, /^missing\|/);
});

test('source mismatch catches API-record edits even when record count and max id are unchanged', async () => {
  const identity = await buildSourceRecordsIdentity(API_RECORDS);
  const edited = API_RECORDS.map(record => (
    record.id === 1 ? { ...record, price: record.price + 1 } : record
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
  const identity = await buildSourceRecordsIdentity(API_RECORDS);
  const result = await assessSnapshotIntegrity(API_RECORDS, snapshotFor(identity, 'SPY'), {
    expectedBenchmark: 'QQQ',
  });

  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.STALE_BENCHMARK);
  assert.equal(result.repairNeeded, true);
  assert.equal(result.manifestBenchmark, 'SPY');
  assert.equal(result.expectedBenchmark, 'QQQ');
  assert.equal(result.currentSource.sha256, identity.sha256);
});

test('mixed API/calculation schema fails closed instead of silently hashing ambiguous records', async () => {
  const mixed = [{
    ...API_RECORDS[0],
    Date: API_RECORDS[0].txn_date,
  }];
  const result = await assessSnapshotIntegrity(
    mixed,
    snapshotFor(await buildSourceRecordsIdentity(API_RECORDS)),
    { expectedBenchmark: 'SPY' },
  );

  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_RECORDS);
  assert.equal(result.repairNeeded, false);
  assert.match(result.fingerprint, /mixes API and calculation schemas/);
});

test('missing or malformed current-engine manifest is repairable but malformed API records fail closed without auto repair', async () => {
  const missingManifest = await assessSnapshotIntegrity(API_RECORDS, {
    updated_at: '2026-08-14T03:30:00Z',
    holdings: [],
  }, { expectedBenchmark: 'SPY' });
  assert.equal(missingManifest.status, SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_MANIFEST);
  assert.equal(missingManifest.repairNeeded, true);

  const malformedRecords = await assessSnapshotIntegrity([
    { ...API_RECORDS[0], qty: 'not-a-number' },
  ], { updated_at: '2026-08-14T03:30:00Z' }, { expectedBenchmark: 'SPY' });
  assert.equal(malformedRecords.status, SNAPSHOT_INTEGRITY_STATUS.UNVERIFIABLE_RECORDS);
  assert.equal(malformedRecords.repairNeeded, false);
});

test('semantic repair fingerprints ignore updated_at churn', async () => {
  const identity = await buildSourceRecordsIdentity(API_RECORDS);
  const edited = API_RECORDS.map(record => (
    record.id === 1 ? { ...record, price: record.price + 1 } : record
  ));

  const staleA = await assessSnapshotIntegrity(edited, snapshotFor(identity), {
    expectedBenchmark: 'SPY',
  });
  const staleSnapshotB = snapshotFor(identity);
  staleSnapshotB.updated_at = '2026-08-14T04:30:00Z';
  const staleB = await assessSnapshotIntegrity(edited, staleSnapshotB, {
    expectedBenchmark: 'SPY',
  });
  assert.equal(staleA.fingerprint, staleB.fingerprint);

  const invalidA = await assessSnapshotIntegrity(API_RECORDS, {
    updated_at: '2026-08-14T03:30:00Z',
    calculation_manifest: { manifest_version: 1 },
  }, { expectedBenchmark: 'SPY' });
  const invalidB = await assessSnapshotIntegrity(API_RECORDS, {
    updated_at: '2026-08-14T04:30:00Z',
    calculation_manifest: { manifest_version: 1 },
  }, { expectedBenchmark: 'SPY' });
  assert.equal(invalidA.fingerprint, invalidB.fingerprint);

  const benchmarkA = await assessSnapshotIntegrity(API_RECORDS, snapshotFor(identity, 'SPY'), {
    expectedBenchmark: 'QQQ',
  });
  const benchmarkSnapshotB = snapshotFor(identity, 'SPY');
  benchmarkSnapshotB.updated_at = '2026-08-14T04:30:00Z';
  const benchmarkB = await assessSnapshotIntegrity(API_RECORDS, benchmarkSnapshotB, {
    expectedBenchmark: 'QQQ',
  });
  assert.equal(benchmarkA.fingerprint, benchmarkB.fingerprint);
});

test('explicit future manifest contracts fail closed instead of being repaired by an older frontend', async () => {
  const identity = await buildSourceRecordsIdentity(API_RECORDS);
  const variants = [
    snapshot => { snapshot.calculation_manifest.manifest_version = 2; },
    snapshot => { snapshot.calculation_manifest.deterministic_identity.identity_version = 2; },
    snapshot => { snapshot.calculation_manifest.deterministic_identity.source_records.canonicalization_version = 2; },
    snapshot => { snapshot.calculation_manifest.deterministic_identity.runtime_config.canonicalization_version = 2; },
  ];

  for (const mutate of variants) {
    const snapshot = snapshotFor({ ...identity });
    mutate(snapshot);
    const result = await assessSnapshotIntegrity(API_RECORDS, snapshot, {
      expectedBenchmark: 'SPY',
    });
    assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.UNSUPPORTED_MANIFEST);
    assert.equal(result.repairNeeded, false);
    assert.match(result.fingerprint, /^manifest-unsupported\|/);
  }
});

test('empty authoritative record set needs no calculation repair', async () => {
  const result = await assessSnapshotIntegrity([], { updated_at: '' }, {
    expectedBenchmark: 'SPY',
  });
  assert.equal(result.status, SNAPSHOT_INTEGRITY_STATUS.EMPTY);
  assert.equal(result.repairNeeded, false);
});
