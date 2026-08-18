import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  LEGACY_BROWSER_TAG,
  OWNED_SMOKE_TAG_PREFIX,
  classifyProductionTestRecord,
  isProductionTestTagCandidate,
} from './production_test_record_contract.mjs';

const SHA_RE = /^[0-9a-f]{40}$/;
const MAX_CANDIDATE_RECORDS = 25;
const CANDIDATE_COLUMNS = [
  'id',
  'user_id',
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
  'note',
];

export function planProductionTestRecordReconciliation(rows, { requireChanges = false } = {}) {
  if (!Array.isArray(rows)) throw new Error('Production test-record query did not return an array');
  if (rows.length > MAX_CANDIDATE_RECORDS) {
    throw new Error(`Refusing reconciliation: candidate row count ${rows.length} exceeds ${MAX_CANDIDATE_RECORDS}`);
  }

  const recognized = [];
  const counts = { legacy_browser: 0, api_smoke: 0 };
  const ownerStats = new Map();
  for (const row of rows) {
    if (!isProductionTestTagCandidate(row)) {
      throw new Error('Production test-record query returned a row outside the candidate tag contract');
    }
    const kind = classifyProductionTestRecord(row);
    if (!kind) {
      throw new Error('Production test-record candidate does not match an exact owned synthetic payload; refusing all mutation');
    }
    const id = Number(row.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Owned production test record has an invalid record id');
    }
    const owner = normalizeOwner(row.user_id);
    const stats = ownerStats.get(owner) || { legacy_browser: 0, api_smoke: 0 };
    stats[kind] += 1;
    ownerStats.set(owner, stats);
    counts[kind] += 1;
    recognized.push({ ...row, id, user_id: owner, kind });
  }

  for (const stats of ownerStats.values()) {
    if (stats.legacy_browser > 1) {
      throw new Error('Dedicated production test tenant has more than one legacy browser record; refusing all mutation');
    }
  }
  if (requireChanges && recognized.length === 0) {
    throw new Error('Reconciliation required at least one owned production test record but found none');
  }
  return { recognized, counts, ownerCount: ownerStats.size };
}

export function buildAtomicDeleteSql(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Atomic production test-record delete requires at least one owned record');
  }
  const normalized = records.map((record) => normalizeOwnedRecord(record));
  const owners = [...new Set(normalized.map((record) => record.user_id))];
  const exactSet = normalized.map((record) => `(${buildExactPredicate(record)})`).join(' OR ');
  const ownerSet = owners.map(sqlString).join(', ');
  const expected = normalized.length;

  return `DELETE FROM records
    WHERE (${exactSet})
      AND (SELECT COUNT(*) FROM records WHERE user_id IN (${ownerSet})) = ${expected}
      AND (SELECT COUNT(*) FROM records WHERE (${exactSet})) = ${expected};
    SELECT changes() AS changed;`;
}

export function executeProductionTestRecordReconciliation({
  runWrangler = defaultRunWrangler,
  expectedSha,
  requireChanges = false,
  outputPath = 'production-test-record-reconciliation.json',
} = {}) {
  const normalizedSha = String(expectedSha || '').trim();
  if (!SHA_RE.test(normalizedSha)) throw new Error('EXPECTED_SHA must be an exact lowercase 40-character SHA');

  const beforeRows = queryCandidates(runWrangler);
  const beforePlan = planProductionTestRecordReconciliation(beforeRows, { requireChanges });
  const verifiedByOwner = new Map();

  for (const owner of new Set(beforePlan.recognized.map((record) => record.user_id))) {
    const ownerRows = queryOwnerRows(runWrangler, owner);
    const ownerPlan = planProductionTestRecordReconciliation(ownerRows, { requireChanges: true });
    if (ownerPlan.ownerCount !== 1 || ownerPlan.recognized.some((record) => record.user_id !== owner)) {
      throw new Error('Dedicated production test tenant query returned an unexpected owner; refusing all mutation');
    }
    const expected = beforePlan.recognized.filter((record) => record.user_id === owner);
    if (!sameRecordIds(expected, ownerPlan.recognized)) {
      throw new Error('Dedicated production test tenant changed during pre-mutation verification; refusing all mutation');
    }
    verifiedByOwner.set(owner, ownerPlan.recognized);
  }

  const verifiedRecords = [...verifiedByOwner.values()].flat();
  let changed = 0;
  if (verifiedRecords.length > 0) {
    const mutation = runWrangler(buildAtomicDeleteSql(verifiedRecords));
    changed = parseScalar(mutation, 'changed');
    if (changed !== verifiedRecords.length) {
      throw new Error(
        `Production test-record atomic mutation rejected or changed unexpected cardinality: expected=${verifiedRecords.length} changed=${changed}`,
      );
    }
  }

  let tenantRecordsRemaining = 0;
  for (const owner of verifiedByOwner.keys()) {
    const remaining = queryOwnerRows(runWrangler, owner);
    tenantRecordsRemaining += remaining.length;
  }
  if (tenantRecordsRemaining !== 0) {
    throw new Error(`Dedicated production test tenant cleanup did not converge: ${tenantRecordsRemaining} record(s) remain`);
  }

  const afterRows = queryCandidates(runWrangler);
  const afterPlan = planProductionTestRecordReconciliation(afterRows);
  if (afterPlan.recognized.length !== 0) {
    throw new Error(`Production test-record reconciliation did not converge: ${afterPlan.recognized.length} owned row(s) remain`);
  }

  const evidence = {
    schema_version: 1,
    check_name: 'production_owned_test_record_reconciliation',
    status: 'passed',
    observed_at: new Date().toISOString(),
    source_sha: normalizedSha,
    selection_contract: {
      legacy_browser_tag: LEGACY_BROWSER_TAG,
      owned_smoke_tag_prefix: OWNED_SMOKE_TAG_PREFIX,
      exact_payload_validation_required: true,
      dedicated_tenant_purity_required: true,
      atomic_all_tenant_mutation_guard: true,
      unrecognized_candidate_fails_closed_before_mutation: true,
      candidate_limit: MAX_CANDIDATE_RECORDS,
      tenant_identity_recorded: false,
      record_ids_recorded: false,
    },
    result: {
      target_rows_before: beforePlan.recognized.length,
      test_tenants_before: beforePlan.ownerCount,
      legacy_browser_rows_before: beforePlan.counts.legacy_browser,
      api_smoke_rows_before: beforePlan.counts.api_smoke,
      mutation_changes: changed,
      target_rows_after: afterPlan.recognized.length,
      test_tenant_records_remaining: tenantRecordsRemaining,
    },
    worker_authorization_changed: false,
  };
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(
    `Production test-record reconciliation passed: before=${evidence.result.target_rows_before} tenants=${evidence.result.test_tenants_before} changed=${changed} after=${evidence.result.target_rows_after}`,
  );
  return evidence;
}

function queryCandidates(runWrangler) {
  const sql = `SELECT ${CANDIDATE_COLUMNS.join(', ')} FROM records WHERE tag = ${sqlString(LEGACY_BROWSER_TAG)} OR tag GLOB ${sqlString(`${OWNED_SMOKE_TAG_PREFIX}*`)} ORDER BY id;`;
  return parseRows(runWrangler(sql));
}

function queryOwnerRows(runWrangler, owner) {
  const sql = `SELECT ${CANDIDATE_COLUMNS.join(', ')} FROM records WHERE user_id = ${sqlString(normalizeOwner(owner))} ORDER BY id;`;
  return parseRows(runWrangler(sql));
}

function normalizeOwnedRecord(record) {
  const kind = classifyProductionTestRecord(record);
  if (!kind) throw new Error('Refusing to build delete SQL for an unowned record');
  const id = Number(record.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Owned production test record id is invalid');
  return { ...record, id, user_id: normalizeOwner(record.user_id), kind };
}

function buildExactPredicate(record) {
  const predicates = [
    `id = ${record.id}`,
    `user_id = ${sqlString(record.user_id)}`,
    `tag = ${sqlString(record.tag)}`,
    "txn_date = '2026-08-13'",
    "symbol = 'AAPL'",
    "txn_type = 'BUY'",
    `qty = ${record.kind === 'legacy_browser' ? '1' : '0.0001'}`,
    'price = 1',
    'COALESCE(fee, 0) = 0',
    'COALESCE(tax, 0) = 0',
  ];
  if (record.kind === 'api_smoke') predicates.push(`note = ${sqlString(record.note)}`);
  return predicates.join(' AND ');
}

function sameRecordIds(left, right) {
  const leftIds = left.map((record) => Number(record.id)).sort((a, b) => a - b);
  const rightIds = right.map((record) => Number(record.id)).sort((a, b) => a - b);
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

function normalizeOwner(value) {
  const owner = String(value || '').trim();
  if (!owner || owner.length > 320) throw new Error('Owned production test record has an invalid tenant identity');
  return owner;
}

function parseRows(payload) {
  const parsed = normalizeWranglerPayload(payload);
  const rows = parsed?.at(-1)?.results;
  if (!Array.isArray(rows)) throw new Error('D1 production test-record query returned invalid results');
  return rows;
}

function parseScalar(payload, key) {
  const parsed = normalizeWranglerPayload(payload);
  const value = Number(parsed?.at(-1)?.results?.[0]?.[key]);
  if (!Number.isInteger(value) || value < 0) throw new Error(`D1 production test-record ${key} result is invalid`);
  return value;
}

function normalizeWranglerPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'string') return JSON.parse(payload);
  throw new Error('Wrangler D1 result must be JSON text or an array');
}

function defaultRunWrangler(command) {
  const wranglerConfig = process.env.WRANGLER_CONFIG || '.wrangler/deploy.toml';
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(executable, [
    'wrangler',
    'd1',
    'execute',
    'DB',
    '--remote',
    '--config',
    wranglerConfig,
    '--command',
    command,
    '--json',
  ], {
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`Wrangler command failed without exposing D1 row data: ${result.stderr || 'unknown error'}`);
  }
  return result.stdout;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function main() {
  const requireChanges = String(process.env.REQUIRE_CHANGES || '') === '1';
  executeProductionTestRecordReconciliation({
    expectedSha: required('EXPECTED_SHA'),
    requireChanges,
    outputPath: process.env.AUDIT_OUTPUT || 'production-test-record-reconciliation.json',
  });
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'production test-record reconciliation failed');
    process.exitCode = 1;
  });
}

export const __test = Object.freeze({ MAX_CANDIDATE_RECORDS });
