import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BrokerNeutralImportExecutionError,
  normalizeCanonicalImportSourceProfile,
  prepareCanonicalTradeImport,
} from '../src/services/brokerNeutralImportExecution.js';
import { createBrokerNeutralRecord } from '../src/services/brokerNeutralRecordCreate.js';
import { PENDING_RECORD_CREATE_V1_STORAGE_PREFIX } from '../src/services/projectStorage.js';
import { runRecordImportBatch } from '../src/services/recordImportBatch.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }
}

const canonicalCsv = (rows = [
  '2026-08-17,NVDA,BUY,1,100,USD',
]) => [
  'txn_date,symbol,txn_type,qty,price,currency',
  ...rows,
].join('\n');

const pendingIntentKeys = storage => (
  [...storage.map.keys()].filter(key => key.startsWith(PENDING_RECORD_CREATE_V1_STORAGE_PREFIX))
);

test('same source profile plus exact CSV produces stable replay keys while duplicate rows keep distinct identities', async () => {
  const source = canonicalCsv([
    '2026-08-17,NVDA,BUY,1,100,USD',
    '2026-08-17,NVDA,BUY,1,100,USD',
  ]);

  const first = await prepareCanonicalTradeImport(source, '  Futu   Main  ');
  const replay = await prepareCanonicalTradeImport(source, 'futu main');

  assert.equal(first.source_profile, 'Futu Main');
  assert.equal(first.source_digest, replay.source_digest);
  assert.deepEqual(
    first.entries.map(entry => entry.idempotencyKey),
    replay.entries.map(entry => entry.idempotencyKey),
  );
  assert.equal(first.entries.length, 2);
  assert.notEqual(first.entries[0].idempotencyKey, first.entries[1].idempotencyKey);
  assert.match(first.entries[0].idempotencyKey, /^csvg1\.[0-9a-f]{64}\.r2$/);
  assert.match(first.entries[1].idempotencyKey, /^csvg1\.[0-9a-f]{64}\.r3$/);
  assert.ok(first.entries.every(entry => entry.record.event_source === 'IMPORT'));
  assert.ok(first.entries.every(entry => entry.record.tag === 'Stock'));
});

test('different profile or edited source intentionally produces different import identities', async () => {
  const source = canonicalCsv();
  const first = await prepareCanonicalTradeImport(source, 'Broker A');
  const otherProfile = await prepareCanonicalTradeImport(source, 'Broker B');
  const editedSource = await prepareCanonicalTradeImport(
    canonicalCsv(['2026-08-17,NVDA,BUY,2,100,USD']),
    'Broker A',
  );

  assert.notEqual(first.source_digest, otherProfile.source_digest);
  assert.notEqual(first.source_digest, editedSource.source_digest);
  assert.notEqual(first.entries[0].idempotencyKey, otherProfile.entries[0].idempotencyKey);
  assert.notEqual(first.entries[0].idempotencyKey, editedSource.entries[0].idempotencyKey);
});

test('execution refuses partial, blocked, empty, or missing-profile sources instead of importing a subset', async () => {
  await assert.rejects(
    () => prepareCanonicalTradeImport(canonicalCsv(), ''),
    error => error instanceof BrokerNeutralImportExecutionError && error.code === 'SOURCE_PROFILE_REQUIRED',
  );

  const partial = [
    'txn_date,symbol,txn_type,qty,price,currency',
    '2026-08-17,NVDA,BUY,1,100,USD',
    '2026-08-17,nvda,BUY,1,100,USD',
  ].join('\n');
  await assert.rejects(
    () => prepareCanonicalTradeImport(partial, 'Broker A'),
    error => error instanceof BrokerNeutralImportExecutionError && error.code === 'PREVIEW_NOT_FULLY_READY',
  );

  const blocked = [
    'txn_date,symbol,txn_type,qty,price,currency,unknown_field',
    '2026-08-17,NVDA,BUY,1,100,USD,x',
  ].join('\n');
  await assert.rejects(
    () => prepareCanonicalTradeImport(blocked, 'Broker A'),
    error => error instanceof BrokerNeutralImportExecutionError && error.code === 'PREVIEW_NOT_FULLY_READY',
  );

  await assert.rejects(
    () => prepareCanonicalTradeImport('txn_date,symbol,txn_type,qty,price,currency\n', 'Broker A'),
    error => error instanceof BrokerNeutralImportExecutionError && error.code === 'PREVIEW_NOT_FULLY_READY',
  );
});

test('source profile normalization is explicit and rejects unsafe control characters', () => {
  assert.deepEqual(normalizeCanonicalImportSourceProfile('  Schwab   Main  '), {
    displayName: 'Schwab Main',
    scopeId: 'schwab main',
  });
  assert.throws(
    () => normalizeCanonicalImportSourceProfile('Broker\u0000A'),
    error => error instanceof BrokerNeutralImportExecutionError && error.code === 'SOURCE_PROFILE_INVALID',
  );
  assert.throws(
    () => normalizeCanonicalImportSourceProfile('x'.repeat(65)),
    error => error instanceof BrokerNeutralImportExecutionError && error.code === 'SOURCE_PROFILE_TOO_LONG',
  );
});

test('durable canonical create posts the exact deterministic key and clears pending intent after confirmation', async () => {
  const prepared = await prepareCanonicalTradeImport(canonicalCsv(), 'Broker A');
  const [entry] = prepared.entries;
  const storage = new MemoryStorage();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      success: true,
      record_id: 321,
      deduplicated: false,
      auto_update: false,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await createBrokerNeutralRecord(entry, {
    storage,
    owner: 'user@example.com',
    getToken: () => 'token-1',
    refreshToken: async () => true,
    apiBaseUrl: 'https://api.example.test/',
    fetchImpl,
  });

  assert.equal(result.committed, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.recordId, 321);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.test/api/records/idempotent');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Idempotency-Key'], entry.idempotencyKey);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');
  assert.deepEqual(JSON.parse(calls[0].options.body), entry.record);
  assert.deepEqual(pendingIntentKeys(storage), []);
});

test('server replay remains authoritative and batch-level sync runs only once when a ledger mutation occurs', async () => {
  const prepared = await prepareCanonicalTradeImport(canonicalCsv([
    '2026-08-17,NVDA,BUY,1,100,USD',
    '2026-08-17,MSFT,BUY,1,200,USD',
  ]), 'Broker A');
  const calls = { refresh: 0, update: 0 };

  const result = await runRecordImportBatch(prepared.entries, {
    createRecord: async (_entry, index) => ({
      committed: true,
      deduplicated: index === 1,
      recoveryStateError: null,
    }),
    refreshRecords: async () => { calls.refresh += 1; },
    requestUpdate: async () => { calls.update += 1; },
  });

  assert.equal(result.status, 'committed');
  assert.equal(result.created, 1);
  assert.equal(result.replayed, 1);
  assert.deepEqual(calls, { refresh: 1, update: 1 });
});
