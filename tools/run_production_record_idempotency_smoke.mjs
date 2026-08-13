import { readFile, writeFile } from 'node:fs/promises';

const SHA_RE = /^[0-9a-f]{40}$/;
const LEGACY_BROWSER_TAG = 'NOW1A-IDEMPOTENCY-TEST-20260813';
const OWNED_SMOKE_TAG_RE = /^NOW1A_API_SMOKE_[A-Za-z0-9]{1,24}_[A-Za-z0-9]{16,24}_(legacy|keyed)$/;
const LEGACY_SMOKE_NOTE = 'automated production idempotency legacy compatibility smoke';
const KEYED_SMOKE_NOTE = 'automated production idempotency keyed replay smoke';

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveRecordId(value, label) {
  const id = Number(value);
  expect(Number.isSafeInteger(id) && id > 0, `${label} must be a positive record ID`);
  return id;
}

function safeRunFragment(value) {
  const normalized = String(value || 'local').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  return normalized || 'local';
}

function normalizeBaseUrl(value, { allowInsecureLocal = false } = {}) {
  const url = new URL(value);
  const isLoopbackHttp = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  expect(
    url.protocol === 'https:' || (allowInsecureLocal && isLoopbackHttp),
    'Production API origin must use HTTPS',
  );
  return url.origin;
}

function isLegacyBrowserTestRecord(record) {
  return record
    && record.tag === LEGACY_BROWSER_TAG
    && record.txn_date === '2026-08-13'
    && record.symbol === 'AAPL'
    && record.txn_type === 'BUY'
    && Number(record.qty) === 1
    && Number(record.price) === 1
    && Number(record.fee) === 0
    && Number(record.tax) === 0;
}

function isOwnedSmokeRecord(record) {
  const tagMatch = String(record?.tag || '').match(OWNED_SMOKE_TAG_RE);
  return record
    && tagMatch
    && record.txn_date === '2026-08-13'
    && record.symbol === 'AAPL'
    && record.txn_type === 'BUY'
    && Number(record.qty) === 0.0001
    && Number(record.price) === 1
    && Number(record.fee) === 0
    && Number(record.tax) === 0
    && record.note === (tagMatch[1] === 'legacy' ? LEGACY_SMOKE_NOTE : KEYED_SMOKE_NOTE);
}

async function requestJson(fetchImpl, baseUrl, token, path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Deliberately do not include raw response content in errors or evidence.
  }
  return { status: response.status, ok: response.ok, payload };
}

async function listTenantRecords(fetchImpl, baseUrl, token) {
  const response = await requestJson(fetchImpl, baseUrl, token, '/api/records?limit=1000');
  expect(response.status === 200 && response.payload?.success === true, `GET /api/records failed HTTP ${response.status}`);
  expect(Array.isArray(response.payload.data), 'GET /api/records returned invalid data');
  expect(response.payload.page?.has_more === false, 'Dedicated production test tenant has more than one page of records');
  return response.payload.data;
}

async function deleteRecord(fetchImpl, baseUrl, token, id) {
  const response = await requestJson(fetchImpl, baseUrl, token, '/api/records', {
    method: 'DELETE',
    body: { id },
  });
  expect(response.status === 200 && response.payload?.success === true, `DELETE /api/records failed HTTP ${response.status}`);
}

async function prepareDedicatedTenant(fetchImpl, baseUrl, token) {
  const initial = await listTenantRecords(fetchImpl, baseUrl, token);
  if (initial.length === 0) {
    return { wasEmpty: true, removedPriorBrowserRecord: false, removedOrphanedSmokeRecords: 0 };
  }

  const priorBrowserRecords = initial.filter(isLegacyBrowserTestRecord);
  const orphanedSmokeRecords = initial.filter(isOwnedSmokeRecord);
  const recognizedCount = priorBrowserRecords.length + orphanedSmokeRecords.length;
  if (priorBrowserRecords.length > 1 || recognizedCount !== initial.length) {
    throw new Error('Dedicated production test tenant is not empty; refusing to delete unrecognized records');
  }

  for (const record of [...priorBrowserRecords, ...orphanedSmokeRecords]) {
    await deleteRecord(fetchImpl, baseUrl, token, positiveRecordId(record.id, 'recognized prior test record'));
  }
  const afterCleanup = await listTenantRecords(fetchImpl, baseUrl, token);
  expect(afterCleanup.length === 0, 'Recognized prior test cleanup did not leave an empty tenant');
  return {
    wasEmpty: false,
    removedPriorBrowserRecord: priorBrowserRecords.length === 1,
    removedOrphanedSmokeRecords: orphanedSmokeRecords.length,
  };
}

async function cleanupCurrentSmoke(fetchImpl, baseUrl, token, tags) {
  const rows = await listTenantRecords(fetchImpl, baseUrl, token);
  const tagSet = new Set(tags);
  const matches = rows.filter((record) => tagSet.has(record.tag) && isOwnedSmokeRecord(record));
  for (const record of matches) {
    await deleteRecord(fetchImpl, baseUrl, token, positiveRecordId(record.id, 'current smoke record'));
  }
  const finalRows = await listTenantRecords(fetchImpl, baseUrl, token);
  expect(finalRows.length === 0, 'Dedicated production test tenant is not empty after smoke cleanup');
  return { removedCurrentSmokeRecords: matches.length, tenantRecordsRemaining: finalRows.length };
}

function makeRecord(tag, note) {
  return {
    txn_date: '2026-08-13',
    symbol: 'AAPL',
    txn_type: 'BUY',
    qty: 0.0001,
    price: 1,
    fee: 0,
    tax: 0,
    tag,
    note,
  };
}

export async function runProductionRecordIdempotencySmoke({
  baseUrl,
  token,
  sourceSha,
  testRunId = 'local',
  fetchImpl = fetch,
  randomUUID = () => crypto.randomUUID(),
  allowInsecureLocal = false,
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowInsecureLocal });
  const normalizedToken = String(token || '').trim();
  const normalizedSha = String(sourceSha || '').trim();
  expect(normalizedToken.length > 20, 'Google ID token is required');
  expect(SHA_RE.test(normalizedSha), 'Source SHA must be an exact lowercase 40-character Git commit SHA');

  const nonce = String(randomUUID()).replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  expect(nonce.length >= 16, 'Unable to create a sufficiently unique smoke nonce');
  const runFragment = safeRunFragment(testRunId);
  const marker = `NOW1A_API_SMOKE_${runFragment}_${nonce}`;
  const legacyTag = `${marker}_legacy`;
  const keyedTag = `${marker}_keyed`;
  const key = `now1a.record.${runFragment}.${nonce}`;
  const cleanupTags = [legacyTag, keyedTag];
  let primaryError = null;
  let result = null;

  try {
    const preflight = await prepareDedicatedTenant(fetchImpl, normalizedBaseUrl, normalizedToken);
    const legacyRecord = makeRecord(legacyTag, LEGACY_SMOKE_NOTE);
    const keyedRecord = makeRecord(keyedTag, KEYED_SMOKE_NOTE);

    const legacy = await requestJson(fetchImpl, normalizedBaseUrl, normalizedToken, '/api/records', {
      method: 'POST',
      body: legacyRecord,
    });
    expect(legacy.status === 200 && legacy.payload?.success === true, `Legacy POST /api/records failed HTTP ${legacy.status}`);
    expect(legacy.payload?.deduplicated === false, 'Legacy POST unexpectedly reported deduplication');

    const keyedFirst = await requestJson(fetchImpl, normalizedBaseUrl, normalizedToken, '/api/records', {
      method: 'POST',
      body: keyedRecord,
      idempotencyKey: key,
    });
    expect(keyedFirst.status === 200 && keyedFirst.payload?.success === true, `Keyed initial POST failed HTTP ${keyedFirst.status}`);
    expect(keyedFirst.payload?.deduplicated === false, 'Initial keyed POST unexpectedly reported deduplication');
    const keyedRecordId = positiveRecordId(keyedFirst.payload?.record_id, 'Initial keyed POST record_id');

    const keyedReplay = await requestJson(fetchImpl, normalizedBaseUrl, normalizedToken, '/api/records', {
      method: 'POST',
      body: keyedRecord,
      idempotencyKey: key,
    });
    expect(keyedReplay.status === 200 && keyedReplay.payload?.success === true, `Keyed replay POST failed HTTP ${keyedReplay.status}`);
    expect(keyedReplay.payload?.deduplicated === true, 'Same key + same payload was not reported as deduplicated');
    expect(positiveRecordId(keyedReplay.payload?.record_id, 'Keyed replay record_id') === keyedRecordId, 'Keyed replay returned a different record ID');

    const conflict = await requestJson(fetchImpl, normalizedBaseUrl, normalizedToken, '/api/records', {
      method: 'POST',
      body: { ...keyedRecord, qty: 0.0002 },
      idempotencyKey: key,
    });
    expect(conflict.status === 409, `Same key + different payload returned HTTP ${conflict.status}, not 409`);
    expect(conflict.payload?.success === false && conflict.payload?.error_meta?.code === 'IDEMPOTENCY_CONFLICT', 'Conflict response did not expose IDEMPOTENCY_CONFLICT');

    const persisted = await listTenantRecords(fetchImpl, normalizedBaseUrl, normalizedToken);
    const legacyMatches = persisted.filter((record) => record.tag === legacyTag);
    const keyedMatches = persisted.filter((record) => record.tag === keyedTag);
    expect(legacyMatches.length === 1, 'Legacy create did not persist exactly one record');
    expect(keyedMatches.length === 1, 'Keyed replay did not persist exactly one record');
    expect(isOwnedSmokeRecord(legacyMatches[0]), 'Legacy create did not preserve the exact owned smoke payload');
    expect(isOwnedSmokeRecord(keyedMatches[0]), 'Keyed replay did not preserve the exact owned smoke payload');
    expect(positiveRecordId(keyedMatches[0].id, 'Persisted keyed record ID') === keyedRecordId, 'Persisted keyed record does not match initial keyed response');
    expect(persisted.length === 2, 'Dedicated tenant contains unexpected records during idempotency smoke');

    result = {
      schema_version: 1,
      check_name: 'production_record_create_idempotency',
      status: 'passed',
      observed_at: new Date().toISOString(),
      source_sha: normalizedSha,
      api_origin: normalizedBaseUrl,
      preflight: {
        tenant_was_empty: preflight.wasEmpty,
        prior_browser_test_record_deleted: preflight.removedPriorBrowserRecord,
        orphaned_prior_smoke_records_deleted: preflight.removedOrphanedSmokeRecords,
      },
      assertions: {
        legacy_without_idempotency_key: { http_status: legacy.status, deduplicated: false, persisted_records: 1 },
        same_key_same_payload_replay: { http_status: keyedReplay.status, deduplicated: true, persisted_records: 1 },
        same_key_different_payload_conflict: { http_status: conflict.status, error_code: 'IDEMPOTENCY_CONFLICT', persisted_records: 1 },
      },
      credential_handling: {
        token_persisted_in_evidence: false,
        record_ids_persisted_in_evidence: false,
      },
    };
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error('Unknown idempotency smoke failure');
  }

  let cleanup;
  let cleanupError = null;
  try {
    cleanup = await cleanupCurrentSmoke(fetchImpl, normalizedBaseUrl, normalizedToken, cleanupTags);
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error('Unknown idempotency smoke cleanup failure');
  }

  if (primaryError && cleanupError) {
    throw new Error(`${primaryError.message}; cleanup also failed: ${cleanupError.message}`);
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;

  result.cleanup = cleanup;
  return result;
}

async function main() {
  const tokenFile = required('PRODUCTION_E2E_ID_TOKEN_FILE');
  const token = (await readFile(tokenFile, 'utf8')).trim();
  const evidence = await runProductionRecordIdempotencySmoke({
    baseUrl: required('PRODUCTION_E2E_API_ORIGIN'),
    token,
    sourceSha: required('EXPECTED_SHA'),
    testRunId: required('GITHUB_RUN_ID'),
  });
  const output = required('PRODUCTION_E2E_EVIDENCE_FILE');
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`Production idempotency smoke passed: source=${evidence.source_sha} cleanup_remaining=${evidence.cleanup.tenantRecordsRemaining}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Production record idempotency smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
