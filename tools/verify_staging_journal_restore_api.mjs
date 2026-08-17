import { readFile } from 'node:fs/promises';
import { formatStagingResponseDiagnostic } from './verify_staging_restore_route.mjs';

const apiOrigin = required('STAGING_WORKER_BASE_URL').replace(/\/$/, '');
const tokenFile = required('STAGING_E2E_ID_TOKEN_FILE');
const sourceSha = required('SOURCE_SHA').toLowerCase();
const runId = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 64);
const token = (await readFile(tokenFile, 'utf8')).trim();
if (!token) throw new Error('staging ID token file is empty');
if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('SOURCE_SHA must be an exact commit SHA');

const marker = `RESTORE_E2E_${runId}_${sourceSha.slice(0, 8)}`;
const idempotencyKey = `restore.e2e.${runId}.${sourceSha.slice(0, 16)}`.slice(0, 128);
const secondKey = `restore.e2e.second.${runId}.${sourceSha.slice(0, 16)}`.slice(0, 128);
if (secondKey === idempotencyKey) throw new Error('staging restore idempotency intents must be distinct');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function api(method, path, { body, headers = {} } = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      const safeDiagnostic = formatStagingResponseDiagnostic({
        status: response.status,
        headers: response.headers,
        payload: null,
      });
      throw new Error(`${method} ${path} returned non-JSON ${safeDiagnostic}`);
    }
  }
  return { response, payload };
}

function diagnostic(result) {
  return formatStagingResponseDiagnostic({
    status: result.response.status,
    headers: result.response.headers,
    payload: result.payload,
  });
}

async function getRecords() {
  const result = await api('GET', '/api/records?limit=1000');
  const { response, payload } = result;
  if (!response.ok || payload?.success !== true || !Array.isArray(payload?.data)) {
    throw new Error(`GET /api/records failed ${diagnostic(result)}`);
  }
  if (payload?.page?.has_more) throw new Error('staging restore tenant unexpectedly exceeds one records page');
  return payload.data;
}

async function getCashEvents() {
  const result = await api('GET', '/api/cash-events');
  const { response, payload } = result;
  if (!response.ok || payload?.success !== true || !Array.isArray(payload?.cash_events)) {
    throw new Error(`GET /api/cash-events failed ${diagnostic(result)}`);
  }
  return payload.cash_events;
}

function buildBackup(price = 1) {
  const records = [
    {
      id: 1,
      txn_date: '2024-01-02',
      symbol: 'AAPL',
      txn_type: 'BUY',
      qty: 0.0001,
      price,
      fee: 0,
      tax: 0,
      tag: marker,
      note: marker,
      created_at: '2024-01-02 12:00:00',
      currency: 'USD',
      executed_at: null,
      execution_sequence: null,
      event_source: 'MANUAL',
    },
  ];
  const cashEvents = [
    {
      id: 1,
      event_date: '2024-01-01',
      event_type: 'OPENING_BALANCE',
      amount: 123.45,
      currency: 'USD',
      note: marker,
      event_source: 'MANUAL',
      created_at: '2024-01-01 12:00:00',
      updated_at: '2024-01-01 12:00:00',
    },
  ];
  return {
    format: 'sheet-trading-journal-backup',
    schema_version: 1,
    generated_at: '2024-01-03T00:00:00.000Z',
    authority: {
      records: 'authenticated_tenant_scoped_api_readback',
      cash_events: 'authenticated_tenant_scoped_api_readback',
      derived_portfolio_snapshot_included: false,
      browser_local_state_included: false,
    },
    counts: { records: records.length, cash_events: cashEvents.length },
    records,
    cash_events: cashEvents,
  };
}

async function deleteRecord(row) {
  const result = await api('DELETE', '/api/records', { body: { id: Number(row.id) } });
  if (!result.response.ok || result.payload?.success !== true) {
    throw new Error(`cleanup DELETE /api/records failed ${diagnostic(result)}`);
  }
}

async function deleteCashEvent(row) {
  const expected = {
    event_date: row.event_date,
    event_type: row.event_type,
    amount: Number(row.amount),
    currency: row.currency,
    note: row.note || '',
  };
  const result = await api('DELETE', '/api/cash-events', {
    body: { id: Number(row.id), expected },
  });
  if (!result.response.ok || result.payload?.success !== true) {
    throw new Error(`cleanup DELETE /api/cash-events failed ${diagnostic(result)}`);
  }
}

async function cleanupMarkerRows() {
  const records = (await getRecords()).filter(row => row.tag === marker && row.note === marker);
  const cashEvents = (await getCashEvents()).filter(row => row.note === marker);
  for (const row of records) await deleteRecord(row);
  for (const row of cashEvents) await deleteCashEvent(row);
}

async function assertTenantEmpty(label) {
  const [records, cashEvents] = await Promise.all([getRecords(), getCashEvents()]);
  if (records.length !== 0 || cashEvents.length !== 0) {
    throw new Error(
      `${label}: synthetic staging restore account must be empty; observed ${records.length} records and ${cashEvents.length} cash events`,
    );
  }
}

async function main() {
  await assertTenantEmpty('precondition');
  const original = buildBackup(1);
  const changed = buildBackup(2);

  try {
    const first = await api('POST', '/api/journal-restore', {
      body: original,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    if (first.response.status !== 201 || first.payload?.success !== true || first.payload?.restored !== true) {
      throw new Error(`initial restore failed ${diagnostic(first)}`);
    }
    if (first.payload?.counts?.records !== 1 || first.payload?.counts?.cash_events !== 1) {
      throw new Error('initial restore returned unexpected counts');
    }
    if (first.payload?.verification_required !== true) {
      throw new Error('initial restore did not require authoritative verification');
    }

    const [afterRecords, afterCash] = await Promise.all([getRecords(), getCashEvents()]);
    const restoredRecords = afterRecords.filter(row => row.tag === marker && row.note === marker);
    const restoredCash = afterCash.filter(row => row.note === marker);
    if (afterRecords.length !== 1 || afterCash.length !== 1 || restoredRecords.length !== 1 || restoredCash.length !== 1) {
      throw new Error('authoritative readback does not exactly match the restored staging backup');
    }

    const replay = await api('POST', '/api/journal-restore', {
      body: original,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    if (replay.response.status !== 200 || replay.payload?.deduplicated !== true || replay.payload?.restored !== false) {
      throw new Error(`same-intent replay was not deduplicated ${diagnostic(replay)}`);
    }
    if ((await getRecords()).length !== 1 || (await getCashEvents()).length !== 1) {
      throw new Error('same-intent replay changed live row multiplicity');
    }

    const conflict = await api('POST', '/api/journal-restore', {
      body: changed,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    if (conflict.response.status !== 409 || conflict.payload?.error_meta?.code !== 'IDEMPOTENCY_CONFLICT') {
      throw new Error(`same-key changed-payload conflict did not fail closed ${diagnostic(conflict)}`);
    }

    const nonEmpty = await api('POST', '/api/journal-restore', {
      body: original,
      headers: { 'Idempotency-Key': secondKey },
    });
    if (nonEmpty.response.status !== 409 || nonEmpty.payload?.error_meta?.code !== 'RESTORE_DESTINATION_NOT_EMPTY') {
      throw new Error(`non-empty restore did not fail closed ${diagnostic(nonEmpty)}`);
    }
  } finally {
    // Cleanup is unconditional: even a malformed success response may have
    // committed live staging rows before an assertion fails.
    await cleanupMarkerRows();
  }

  await assertTenantEmpty('post-cleanup');

  const postCleanupReplay = await api('POST', '/api/journal-restore', {
    body: original,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  if (postCleanupReplay.response.status !== 200 || postCleanupReplay.payload?.deduplicated !== true) {
    throw new Error(`completed restore replay after cleanup was not a no-op ${diagnostic(postCleanupReplay)}`);
  }
  await assertTenantEmpty('post-replay');

  console.log(
    `Staging journal restore verified at ${sourceSha}: atomic create, authoritative readback, replay deduplication, conflict/non-empty blocking, and cleanup all passed`,
  );
}

main().catch(async (error) => {
  console.error(`Staging journal restore verification failed: ${error.message}`);
  try {
    await cleanupMarkerRows();
  } catch (cleanupError) {
    console.error(`Emergency staging cleanup failed: ${cleanupError.message}`);
  }
  process.exitCode = 1;
});