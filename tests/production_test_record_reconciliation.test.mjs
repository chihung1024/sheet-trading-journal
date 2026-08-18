import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  KEYED_SMOKE_NOTE,
  LEGACY_BROWSER_TAG,
  LEGACY_SMOKE_NOTE,
  classifyProductionTestRecord,
  isLegacyBrowserTestRecord,
  isOwnedSmokeRecord,
} from '../tools/production_test_record_contract.mjs';
import {
  __test,
  buildExactDeleteSql,
  executeProductionTestRecordReconciliation,
  planProductionTestRecordReconciliation,
} from '../tools/reconcile_production_test_records.mjs';

const SOURCE_SHA = '1234567890abcdef1234567890abcdef12345678';
const LEGACY = {
  id: 1,
  txn_date: '2026-08-13',
  symbol: 'AAPL',
  txn_type: 'BUY',
  qty: 1,
  price: 1,
  fee: 0,
  tax: 0,
  tag: LEGACY_BROWSER_TAG,
  note: '',
};
const SMOKE_LEGACY = {
  id: 2,
  txn_date: '2026-08-13',
  symbol: 'AAPL',
  txn_type: 'BUY',
  qty: 0.0001,
  price: 1,
  fee: 0,
  tax: 0,
  tag: 'NOW1A_API_SMOKE_12345_00112233445566778899aabb_legacy',
  note: LEGACY_SMOKE_NOTE,
};
const SMOKE_KEYED = {
  ...SMOKE_LEGACY,
  id: 3,
  tag: 'NOW1A_API_SMOKE_12345_00112233445566778899aabb_keyed',
  note: KEYED_SMOKE_NOTE,
};

const wrangler = (rows) => [{ results: rows, success: true }];

test('shared ownership contract recognizes only exact production synthetic payloads', () => {
  assert.equal(isLegacyBrowserTestRecord(LEGACY), true);
  assert.equal(classifyProductionTestRecord(LEGACY), 'legacy_browser');
  assert.equal(isOwnedSmokeRecord(SMOKE_LEGACY), true);
  assert.equal(isOwnedSmokeRecord(SMOKE_KEYED), true);
  assert.equal(classifyProductionTestRecord(SMOKE_KEYED), 'api_smoke');

  assert.equal(classifyProductionTestRecord({ ...LEGACY, qty: 2 }), null);
  assert.equal(classifyProductionTestRecord({ ...SMOKE_LEGACY, note: KEYED_SMOKE_NOTE }), null);
  assert.equal(classifyProductionTestRecord({ ...SMOKE_LEGACY, tag: 'NOW1A_API_SMOKE_bad_legacy' }), null);
});

test('planner fails closed before mutation when any candidate tag has an unowned payload', () => {
  const forged = { ...SMOKE_LEGACY, id: 9, qty: 99 };
  assert.throws(
    () => planProductionTestRecordReconciliation([LEGACY, forged]),
    /does not match an exact owned synthetic payload/,
  );
});

test('planner supports no-op maintenance but can require an actual cleanup', () => {
  assert.deepEqual(planProductionTestRecordReconciliation([]), {
    recognized: [],
    counts: { legacy_browser: 0, api_smoke: 0 },
  });
  assert.throws(
    () => planProductionTestRecordReconciliation([], { requireChanges: true }),
    /required at least one owned production test record/,
  );
});

test('planner enforces a bounded candidate set', () => {
  const rows = Array.from({ length: __test.MAX_CANDIDATE_RECORDS + 1 }, (_, index) => ({ ...LEGACY, id: index + 1 }));
  assert.throws(() => planProductionTestRecordReconciliation(rows), /candidate row count/);
});

test('exact delete SQL is record-id and payload guarded and refuses unowned records', () => {
  const legacySql = buildExactDeleteSql(LEGACY);
  assert.match(legacySql, /id = 1/);
  assert.match(legacySql, /NOW1A-IDEMPOTENCY-TEST-20260813/);
  assert.match(legacySql, /qty = 1/);
  assert.doesNotMatch(legacySql, /note =/);

  const smokeSql = buildExactDeleteSql(SMOKE_KEYED);
  assert.match(smokeSql, /id = 3/);
  assert.match(smokeSql, /qty = 0\.0001/);
  assert.match(smokeSql, /automated production idempotency keyed replay smoke/);
  assert.throws(() => buildExactDeleteSql({ ...LEGACY, tag: 'DO-NOT-DELETE' }), /unowned record/);
});

test('reconciler removes only recognized rows and emits sanitized aggregate evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'production-test-reconcile-'));
  const outputPath = join(directory, 'evidence.json');
  const calls = [];
  let phase = 0;
  const fakeRunWrangler = (sql) => {
    calls.push(sql);
    if (sql.startsWith('SELECT ')) {
      phase += 1;
      return phase === 1 ? wrangler([LEGACY, SMOKE_KEYED]) : wrangler([]);
    }
    if (sql.startsWith('DELETE ')) return wrangler([{ changed: 1 }]);
    throw new Error(`unexpected SQL: ${sql}`);
  };

  try {
    const evidence = executeProductionTestRecordReconciliation({
      runWrangler: fakeRunWrangler,
      expectedSha: SOURCE_SHA,
      requireChanges: true,
      outputPath,
    });
    assert.deepEqual(evidence.result, {
      target_rows_before: 2,
      legacy_browser_rows_before: 1,
      api_smoke_rows_before: 1,
      mutation_changes: 2,
      target_rows_after: 0,
    });
    assert.equal(calls.filter((sql) => sql.startsWith('DELETE ')).length, 2);
    const persisted = await readFile(outputPath, 'utf8');
    assert.equal(persisted.includes('"id"'), false);
    assert.equal(persisted.includes('user_id'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reconciler fails when an exact-row delete does not mutate exactly one row', () => {
  let queryCount = 0;
  const fakeRunWrangler = (sql) => {
    if (sql.startsWith('SELECT ')) {
      queryCount += 1;
      return wrangler(queryCount === 1 ? [LEGACY] : []);
    }
    return wrangler([{ changed: 0 }]);
  };
  assert.throws(
    () => executeProductionTestRecordReconciliation({
      runWrangler: fakeRunWrangler,
      expectedSha: SOURCE_SHA,
      requireChanges: true,
      outputPath: '/tmp/should-not-exist-production-reconcile.json',
    }),
    /mutation cardinality mismatch/,
  );
});

test('reconciler fails if owned candidates remain after mutation', () => {
  let queryCount = 0;
  const fakeRunWrangler = (sql) => {
    if (sql.startsWith('SELECT ')) {
      queryCount += 1;
      return wrangler([LEGACY]);
    }
    return wrangler([{ changed: 1 }]);
  };
  assert.throws(
    () => executeProductionTestRecordReconciliation({
      runWrangler: fakeRunWrangler,
      expectedSha: SOURCE_SHA,
      outputPath: '/tmp/should-not-exist-production-reconcile.json',
    }),
    /did not converge/,
  );
  assert.equal(queryCount, 2);
});
