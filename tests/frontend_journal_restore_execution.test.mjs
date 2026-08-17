import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildJournalBackupPackage } from '../src/services/journalBackupExport.js';
import {
  executeJournalRestore,
  probeJournalRestoreCapability,
  verifyJournalRestoreReadback,
} from '../src/services/journalRestoreExecution.js';
import {
  beginJournalRestoreIntent,
  completeJournalRestoreIntent,
  readJournalRestoreIntent,
} from '../src/services/journalRestoreIntent.js';
import { clearSensitiveProjectStorage } from '../src/services/projectStorage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}

const record = (overrides = {}) => ({
  id: 1,
  txn_date: '2026-08-01',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 2,
  price: 100,
  fee: 1,
  tax: 0,
  tag: 'Stock',
  note: 'restore execution test',
  created_at: '2026-08-01 12:00:00',
  currency: 'USD',
  executed_at: '2026-08-01T20:00:00Z',
  execution_sequence: 'order-1:fill-1',
  event_source: 'IBKR',
  ...overrides,
});

const cashEvent = (overrides = {}) => ({
  id: 10,
  event_date: '2026-07-31',
  event_type: 'OPENING_BALANCE',
  amount: 500,
  currency: 'USD',
  note: 'baseline',
  event_source: 'MANUAL',
  created_at: '2026-08-17 01:00:00',
  updated_at: '2026-08-17 01:00:00',
  ...overrides,
});

const backup = ({ records = [record()], cashEvents = [cashEvent()], generatedAt = '2026-08-17T07:00:00Z' } = {}) => (
  buildJournalBackupPackage({ records, cashEvents, generatedAt })
);

const jsonResponse = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers },
});

const exactReadbackFetch = (source) => async (url, init = {}) => {
  const parsed = new URL(String(url));
  assert.match(String(init.headers?.Authorization || ''), /^Bearer /);
  if (parsed.pathname === '/api/records') {
    return jsonResponse({
      success: true,
      data: source.records.map((item, index) => ({
        ...item,
        id: 1000 + index,
        created_at: `2026-08-18 00:00:0${index}`,
      })),
      page: { limit: 1000, count: source.records.length, has_more: false, next_cursor: null },
    });
  }
  if (parsed.pathname === '/api/cash-events') {
    return jsonResponse({
      success: true,
      cash_events: source.cash_events.map((item, index) => ({
        ...item,
        id: 2000 + index,
        created_at: `2026-08-18 00:01:0${index}`,
        updated_at: `2026-08-18 00:02:0${index}`,
      })),
    });
  }
  throw new Error(`Unexpected readback URL ${parsed.pathname}`);
};

test('restore intent persists one opaque key for the same accepted backup without storing financial rows', async () => {
  const storage = new MemoryStorage();
  const source = backup();
  const ids = ['restore-key-000000000001', 'restore-key-000000000002'];
  let nextId = 0;

  const first = await beginJournalRestoreIntent(storage, 'restore-owner', source, {
    now: 1000,
    createOpaqueId: () => ids[nextId++],
  });
  const second = await beginJournalRestoreIntent(storage, 'restore-owner', source, {
    now: 1100,
    createOpaqueId: () => ids[nextId++],
  });

  assert.equal(first.idempotencyKey, ids[0]);
  assert.equal(second.idempotencyKey, ids[0]);
  assert.equal(nextId, 1, 'same backup must not generate a second key');

  const persisted = [...storage.values.values()].join('\n');
  assert.doesNotMatch(persisted, /NVDA|restore execution test|OPENING_BALANCE/);
  assert.match(persisted, /"fingerprint":"[0-9a-f]{64}"/);

  const changed = backup({ records: [record({ price: 101 })] });
  const rotated = await beginJournalRestoreIntent(storage, 'restore-owner', changed, {
    now: 1200,
    createOpaqueId: () => ids[nextId++],
  });
  assert.equal(rotated.idempotencyKey, ids[1]);
  assert.notEqual(rotated.fingerprint, first.fingerprint);
});

test('restore intent is tenant-bound, expiring, and included in project-sensitive logout cleanup', async () => {
  const storage = new MemoryStorage();
  const source = backup();
  const intent = await beginJournalRestoreIntent(storage, 'Owner-A', source, {
    now: 1000,
    createOpaqueId: () => 'restore-key-owner-a-00001',
  });

  assert.equal(readJournalRestoreIntent(storage, 'owner-a', { now: 2000 })?.idempotencyKey, intent.idempotencyKey);
  assert.equal(readJournalRestoreIntent(storage, 'owner-b', { now: 2000 }), null);
  assert.equal(completeJournalRestoreIntent(storage, 'owner-b', intent.idempotencyKey), false);

  clearSensitiveProjectStorage(storage);
  assert.equal(storage.length, 0);
});

test('non-mutating capability probe requires the reviewed 405 METHOD_NOT_ALLOWED contract', async () => {
  const available = await probeJournalRestoreCapability({
    apiBaseUrl: 'https://api.test',
    fetchImpl: async (_url, init) => {
      assert.equal(init.method, 'GET');
      return jsonResponse({
        success: false,
        error: 'Method not allowed',
        error_meta: { code: 'METHOD_NOT_ALLOWED', request_id: 'req-1' },
      }, 405, {
        'X-Source-Commit': 'abcdef1234567890',
        'X-Worker-Version-Id': 'worker-1',
      });
    },
  });
  assert.equal(available.available, true);
  assert.equal(available.source_commit, 'abcdef1234567890');

  const missing = await probeJournalRestoreCapability({
    apiBaseUrl: 'https://api.test',
    fetchImpl: async () => jsonResponse({
      success: false,
      error: 'Route not found',
      error_meta: { code: 'NOT_FOUND' },
    }, 404),
  });
  assert.equal(missing.available, false);
  assert.equal(missing.reason, 'route_unavailable');

  const wrongContract = await probeJournalRestoreCapability({
    apiBaseUrl: 'https://api.test',
    fetchImpl: async () => jsonResponse({ success: true }, 200),
  });
  assert.equal(wrongContract.available, false);
  assert.equal(wrongContract.reason, 'unexpected_capability_contract');
});

test('restore execution sends the provided key, validates counts, and refreshes auth once on 401', async () => {
  const source = backup();
  let token = 'expired-token';
  let calls = 0;
  let refreshes = 0;

  const result = await executeJournalRestore({
    backup: source,
    idempotencyKey: 'restore-key-execution-0001',
    apiBaseUrl: 'https://api.test',
    getToken: () => token,
    refreshToken: async () => {
      refreshes += 1;
      token = 'fresh-token';
      return true;
    },
    fetchImpl: async (_url, init) => {
      calls += 1;
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['Idempotency-Key'], 'restore-key-execution-0001');
      if (calls === 1) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      assert.equal(init.headers.Authorization, 'Bearer fresh-token');
      return jsonResponse({
        success: true,
        restored: true,
        deduplicated: false,
        counts: { records: 1, cash_events: 1 },
        verification_required: true,
      }, 201);
    },
  });

  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
  assert.deepEqual(result.counts, { records: 1, cash_events: 1 });
  assert.equal(result.restored, true);
});

test('ambiguous POST failures remain retryable with the caller-owned idempotency key', async () => {
  const source = backup();
  await assert.rejects(
    executeJournalRestore({
      backup: source,
      idempotencyKey: 'restore-key-ambiguous-0001',
      apiBaseUrl: 'https://api.test',
      getToken: () => 'token',
      refreshToken: async () => true,
      fetchImpl: async () => { throw new Error('network lost after send'); },
    }),
    error => error.outcomeAmbiguous === true,
  );

  await assert.rejects(
    executeJournalRestore({
      backup: source,
      idempotencyKey: 'restore-key-malformed-0001',
      apiBaseUrl: 'https://api.test',
      getToken: () => 'token',
      refreshToken: async () => true,
      fetchImpl: async () => jsonResponse({
        success: true,
        restored: true,
        deduplicated: false,
        counts: { records: 99, cash_events: 1 },
        verification_required: true,
      }, 201),
    }),
    error => error.outcomeAmbiguous === true,
  );
});

test('schema-unavailable is definite fail-closed evidence while database 500 remains ambiguous', async () => {
  const source = backup();

  await assert.rejects(
    executeJournalRestore({
      backup: source,
      idempotencyKey: 'restore-key-schema-000001',
      apiBaseUrl: 'https://api.test',
      getToken: () => 'token',
      refreshToken: async () => true,
      fetchImpl: async () => jsonResponse({
        success: false,
        error: 'Restore storage is not ready',
        error_meta: { code: 'RESTORE_SCHEMA_UNAVAILABLE' },
      }, 503),
    }),
    error => error.apiCode === 'RESTORE_SCHEMA_UNAVAILABLE' && error.outcomeAmbiguous === false,
  );

  await assert.rejects(
    executeJournalRestore({
      backup: source,
      idempotencyKey: 'restore-key-db-error-00001',
      apiBaseUrl: 'https://api.test',
      getToken: () => 'token',
      refreshToken: async () => true,
      fetchImpl: async () => jsonResponse({
        success: false,
        error: 'Atomic restore failed',
        error_meta: { code: 'RESTORE_DATABASE_ERROR' },
      }, 500),
    }),
    error => error.apiCode === 'RESTORE_DATABASE_ERROR' && error.outcomeAmbiguous === true,
  );
});

test('authoritative post-write readback must match every portable record and cash provenance field', async () => {
  const source = backup();
  const verified = await verifyJournalRestoreReadback({
    backup: source,
    apiBaseUrl: 'https://api.test',
    getToken: () => 'token',
    refreshToken: async () => true,
    fetchImpl: exactReadbackFetch(source),
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.preview.status, 'already_restored');

  const mismatchedCashSource = backup({ cashEvents: [cashEvent({ event_source: 'IMPORT' })] });
  const mismatch = await verifyJournalRestoreReadback({
    backup: source,
    apiBaseUrl: 'https://api.test',
    getToken: () => 'token',
    refreshToken: async () => true,
    fetchImpl: exactReadbackFetch(mismatchedCashSource),
  });
  assert.equal(mismatch.verified, false);
  assert.equal(mismatch.preview.status, 'conflict_nonempty');
});

test('restore component requires explicit confirmation and keeps execution behind capability/readback gates', () => {
  const component = fs.readFileSync(path.join(ROOT, 'src/components/JournalRestoreButton.vue'), 'utf8');
  const previewService = fs.readFileSync(path.join(ROOT, 'src/services/journalRestorePreview.js'), 'utf8');
  const intentService = fs.readFileSync(path.join(ROOT, 'src/services/journalRestoreIntent.js'), 'utf8');

  assert.match(component, /繼續安全還原/);
  assert.match(component, /最終確認/);
  assert.match(component, /確認建立紀錄/);
  assert.match(component, /probeJournalRestoreCapability/);
  assert.match(component, /beginJournalRestoreIntent/);
  assert.match(component, /verifyJournalRestoreReadback/);
  assert.match(component, /portfolioStore\.fetchRecords\(\)/);
  assert.match(component, /portfolioStore\.markSnapshotStale\(\)/);
  assert.match(component, /portfolioStore\.triggerUpdate\(\)/);
  assert.match(component, /使用原識別碼重新確認/);
  assert.match(previewService, /writes_allowed:\s*false/);
  assert.doesNotMatch(intentService, /records\s*:/);
  assert.doesNotMatch(intentService, /cash_events\s*:/);
});
