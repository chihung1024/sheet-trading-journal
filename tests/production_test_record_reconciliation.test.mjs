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
const OWNER = 'production-test@example.test';
const LEGACY = {
  id: 1,
  user_id: OWNER,
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
  user_id: OWNER,
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
const NORMAL_RECORD = {
  id: 4,
  user_id: OWNER,
  txn_date: '2026-08-14',
  symbol: 'MSFT',
  txn_type: 'BUY',
  qty: 1,
  price: 100,
  fee: 0,
  tax: 0,
  tag: 'Stock',
  note: 'real tenant data',
};

const wrangler = (rows) => [{ results: rows, success: true }];

function isGlobalCandidateQuery(sql) {
  return sql.startsWith('SELECT ') && sql.includes('WHERE tag =');
}

function isOwnerQuery(sql) {
  return sql.startsWith('SELECT ') && sql.includes('WHERE user_id =');
}

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
    ownerCount: 0,
  });
  assert.throws(
    () => planProductionTestRecordReconciliation([], { requireChanges: true }),
    /required at least one owned production test record/,
  );
});

test('planner rejects duplicate legacy browser markers inside one dedicated tenant', () => {
  assert.throws(
    () => planProductionTestRecordReconciliation([LEGACY, { ...LEGACY, id: 7 }]),
    /more than one legacy browser record/,
  );
});

test('planner rejects missing tenant identity and enforces a bounded candidate set', () => {
  assert.throws(
    () => planProductionTestRecordReconciliation([{ ...LEGACY, user_id: '' }]),
    /invalid tenant identity/,
  );
  const rows = Array.from(
    { length: __test.MAX_CANDIDATE_RECORDS + 1 },
    (_, index) => ({ ...SMOKE_KEYED, id: index + 1 }),
  );
  assert.throws(() => planProductionTestRecordReconciliation(rows), /candidate row count/);
});

test('exact delete SQL is tenant, record-id, and payload guarded and refuses unowned records', () => {
  const legacySql = buildExactDeleteSql(LEGACY);
  assert.match(legacySql, /id = 1/);
  assert.match(legacySql, /user_id = 'production-test@example\.test'/);
  assert.match(legacySql, /NOW1A-IDEMPOTENCY-TEST-20260813/);
  assert.match(legacySql, /qty = 1/);
  assert.doesNotMatch(legacySql, /note =/);

  const smokeSql = buildExactDeleteSql(SMOKE_KEYED);
  assert.match(smokeSql, /id = 3/);
  assert.match(smokeSql, /user_id = 'production-test@example\.test'/);
  assert.match(smokeSql, /qty = 0\.0001/);
  assert.match(smokeSql, /automated production idempotency keyed replay smoke/);
  assert.throws(() => buildExactDeleteSql({ ...LEGACY, tag: 'DO-NOT-DELETE' }), /unowned record/);
});

test('reconciler removes only a pure dedicated synthetic tenant and emits sanitized aggregate evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'production-test-reconcile-'));
  const outputPath = join(directory, 'evidence.json');
  const calls = [];
  let globalQueries = 0;
  let ownerQueries = 0;
  const fakeRunWrangler = (sql) => {
    calls.push(sql);
    if (isGlobalCandidateQuery(sql)) {
      globalQueries += 1;
      return globalQueries === 1 ? wrangler([LEGACY, SMOKE_KEYED]) : wrangler([]);
    }
    if (isOwnerQuery(sql)) {
      ownerQueries += 1;
      return ownerQueries === 1 ? wrangler([LEGACY, SMOKE_KEYED]) : wrangler([]);
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
      test_tenants_before: 1,
      legacy_browser_rows_before: 1,
      api_smoke_rows_before: 1,
      mutation_changes: 2,
      target_rows_after: 0,
      test_tenant_records_remaining: 0,
    });
    assert.equal(calls.filter((sql) => sql.startsWith('DELETE ')).length, 2);
    const persisted = await readFile(outputPath, 'utf8');
    assert.equal(persisted.includes(OWNER), false);
    assert.equal(persisted.includes('"user_id"'), false);
    assert.equal(persisted.includes('"id"'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reconciler refuses all mutation when a candidate owner also contains normal user data', () => {
  const calls = [];
  const fakeRunWrangler = (sql) => {
    calls.push(sql);
    if (isGlobalCandidateQuery(sql)) return wrangler([LEGACY]);
    if (isOwnerQuery(sql)) return wrangler([LEGACY, NORMAL_RECORD]);
    throw new Error(`unexpected mutation: ${sql}`);
  };

  assert.throws(
    () => executeProductionTestRecordReconciliation({
      runWrangler: fakeRunWrangler,
      expectedSha: SOURCE_SHA,
      requireChanges: true,
      outputPath: '/tmp/should-not-exist-production-reconcile.json',
    }),
    /outside the candidate tag contract/,
  );
  assert.equal(calls.some((sql) => sql.startsWith('DELETE ')), false);
});

test('reconciler refuses all mutation if the dedicated tenant changes between discovery and mutation', () => {
  const calls = [];
  const fakeRunWrangler = (sql) => {
    calls.push(sql);
    if (isGlobalCandidateQuery(sql)) return wrangler([LEGACY]);
    if (isOwnerQuery(sql)) return wrangler([LEGACY, SMOKE_KEYED]);
    throw new Error(`unexpected mutation: ${sql}`);
  };

  assert.throws(
    () => executeProductionTestRecordReconciliation({
      runWrangler: fakeRunWrangler,
      expectedSha: SOURCE_SHA,
      requireChanges: true,
      outputPath: '/tmp/should-not-exist-production-reconcile.json',
    }),
    /changed during pre-mutation verification/,
  );
  assert.equal(calls.some((sql) => sql.startsWith('DELETE ')), false);
});

test('reconciler fails when an exact-row delete does not mutate exactly one row', () => {
  const fakeRunWrangler = (sql) => {
    if (isGlobalCandidateQuery(sql)) return wrangler([LEGACY]);
    if (isOwnerQuery(sql)) return wrangler([LEGACY]);
    if (sql.startsWith('DELETE ')) return wrangler([{ changed: 0 }]);
    throw new Error(`unexpected SQL: ${sql}`);
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

test('reconciler fails if a dedicated synthetic tenant is not empty after deletion', () => {
  let ownerQueries = 0;
  const fakeRunWrangler = (sql) => {
    if (isGlobalCandidateQuery(sql)) return wrangler([LEGACY]);
    if (isOwnerQuery(sql)) {
      ownerQueries += 1;
      return wrangler([LEGACY]);
    }
    if (sql.startsWith('DELETE ')) return wrangler([{ changed: 1 }]);
    throw new Error(`unexpected SQL: ${sql}`);
  };
  assert.throws(
    () => executeProductionTestRecordReconciliation({
      runWrangler: fakeRunWrangler,
      expectedSha: SOURCE_SHA,
      outputPath: '/tmp/should-not-exist-production-reconcile.json',
    }),
    /tenant cleanup did not converge/,
  );
  assert.equal(ownerQueries, 2);
});
