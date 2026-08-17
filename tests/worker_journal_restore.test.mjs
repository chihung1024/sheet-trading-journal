import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { __test as canonicalTest } from '../worker.js';
import {
  __test as restoreTest,
  applyAtomicJournalRestore,
  hashJournalRestorePayload,
  normalizeJournalRestoreBackup,
  tryHandleJournalRestore,
} from '../worker-journal-restore.js';

const USER = 'restore-user@example.com';
const KEY_A = 'journal.restore.0123456789abcdef';
const KEY_B = 'journal.restore.fedcba9876543210';

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
  note: 'restore regression',
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

const backup = ({ records = [record()], cashEvents = [cashEvent()] } = {}) => ({
  format: 'sheet-trading-journal-backup',
  schema_version: 1,
  generated_at: '2026-08-17T07:00:00.000Z',
  authority: {
    records: 'authenticated_tenant_scoped_api_readback',
    cash_events: 'authenticated_tenant_scoped_api_readback',
    derived_portfolio_snapshot_included: false,
    browser_local_state_included: false,
  },
  counts: { records: records.length, cash_events: cashEvents.length },
  records,
  cash_events: cashEvents,
});

function createRestoreDb({ initialRecords = [], initialCashEvents = [], failOnCash = false } = {}) {
  const state = {
    records: initialRecords.map(item => ({ ...item })),
    cashEvents: initialCashEvents.map(item => ({ ...item })),
    sessions: [],
  };

  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return { sql: normalized, args };
        },
      };
    },
    async batch(statements) {
      const draft = {
        records: state.records.map(item => ({ ...item })),
        cashEvents: state.cashEvents.map(item => ({ ...item })),
        sessions: state.sessions.map(item => ({ ...item })),
      };
      const results = [];

      for (const statement of statements) {
        const { sql, args } = statement;
        if (sql.startsWith('INSERT OR IGNORE INTO journal_restore_sessions')) {
          const [userId, idempotencyHash, payloadHash, schemaVersion, recordCount, cashCount] = args;
          const sameKey = draft.sessions.find(item => item.user_id === userId && item.idempotency_hash === idempotencyHash);
          const liveEmpty = !draft.records.some(item => item.user_id === userId)
            && !draft.cashEvents.some(item => item.user_id === userId);
          if (!sameKey && liveEmpty) {
            draft.sessions.push({
              user_id: userId,
              idempotency_hash: idempotencyHash,
              payload_hash: payloadHash,
              backup_schema_version: schemaVersion,
              expected_record_count: recordCount,
              expected_cash_event_count: cashCount,
              status: 'pending',
            });
            results.push({ meta: { changes: 1 } });
          } else {
            results.push({ meta: { changes: 0 } });
          }
          continue;
        }

        if (sql.startsWith('INSERT INTO records')) {
          const [userId, rowsJson, guardUser, idempotencyHash, payloadHash] = args;
          const session = draft.sessions.find(item => item.user_id === guardUser
            && item.idempotency_hash === idempotencyHash
            && item.payload_hash === payloadHash
            && item.status === 'pending');
          const rows = session ? JSON.parse(rowsJson) : [];
          for (const item of rows) draft.records.push({ user_id: userId, ...item });
          results.push({ meta: { changes: rows.length } });
          continue;
        }

        if (sql.startsWith('INSERT INTO cash_events')) {
          if (failOnCash) throw new Error('synthetic cash insert failure');
          const [userId, rowsJson, guardUser, idempotencyHash, payloadHash] = args;
          const session = draft.sessions.find(item => item.user_id === guardUser
            && item.idempotency_hash === idempotencyHash
            && item.payload_hash === payloadHash
            && item.status === 'pending');
          const rows = session ? JSON.parse(rowsJson) : [];
          for (const item of rows) draft.cashEvents.push({ user_id: userId, ...item });
          results.push({ meta: { changes: rows.length } });
          continue;
        }

        if (sql.startsWith('UPDATE journal_restore_sessions')) {
          const [recordUser, cashUser, userId, idempotencyHash, payloadHash] = args;
          const session = draft.sessions.find(item => item.user_id === userId
            && item.idempotency_hash === idempotencyHash
            && item.payload_hash === payloadHash
            && item.status === 'pending');
          if (!session) {
            results.push({ meta: { changes: 0 } });
            continue;
          }
          const recordCount = draft.records.filter(item => item.user_id === recordUser).length;
          const cashCount = draft.cashEvents.filter(item => item.user_id === cashUser).length;
          if (recordCount !== session.expected_record_count || cashCount !== session.expected_cash_event_count) {
            throw new Error('CHECK constraint failed: completion_guard');
          }
          session.status = 'completed';
          results.push({ meta: { changes: 1 } });
          continue;
        }

        if (sql.startsWith('SELECT idempotency_hash, payload_hash, status')) {
          const [userId, idempotencyHash] = args;
          const session = draft.sessions.find(item => item.user_id === userId && item.idempotency_hash === idempotencyHash);
          results.push({ results: session ? [{ ...session }] : [] });
          continue;
        }

        throw new Error(`Unexpected restore SQL: ${sql}`);
      }

      state.records = draft.records;
      state.cashEvents = draft.cashEvents;
      state.sessions = draft.sessions;
      return results;
    },
  };

  return { db, state };
}

test('0006 is additive and provides a tenant-scoped durable restore guard without advancing canonical schema', async () => {
  const migration = await readFile('migrations/0006_journal_restore_sessions.sql', 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS journal_restore_sessions/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS idx_journal_restore_user_idempotency/);
  assert.match(migration, /completion_guard INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /CHECK \(completion_guard = 1\)/);
  assert.doesNotMatch(migration, /UPDATE schema_metadata/);
});

test('restore backup validation is fail-closed and reuses canonical record/cash rules', () => {
  const normalized = normalizeJournalRestoreBackup(backup(), canonicalTest);
  assert.equal(normalized.records.length, 1);
  assert.equal(normalized.cash_events.length, 1);
  assert.equal('id' in normalized.records[0], false);
  assert.equal('created_at' in normalized.records[0], false);

  assert.throws(
    () => normalizeJournalRestoreBackup({ ...backup(), future_field: true }, canonicalTest),
    /unsupported fields/,
  );
  assert.throws(
    () => normalizeJournalRestoreBackup(backup({ records: [record({ note: '  not canonical  ' })] }), canonicalTest),
    /note is not canonical/,
  );
  assert.throws(
    () => normalizeJournalRestoreBackup(backup({ cashEvents: [cashEvent({ event_source: 'FUTURE' })] }), canonicalTest),
    /reviewed source token/,
  );
  assert.throws(
    () => normalizeJournalRestoreBackup(backup({
      cashEvents: [cashEvent(), cashEvent({ id: 11, amount: 501 })],
    }), canonicalTest),
    /multiple opening balances/,
  );
});

test('restore payload hash is order-insensitive while preserving legitimate duplicate multiplicity', async () => {
  const a = normalizeJournalRestoreBackup(backup({
    records: [record(), record({ id: 2, execution_sequence: 'order-1:fill-2' })],
  }), canonicalTest);
  const b = normalizeJournalRestoreBackup(backup({
    records: [record({ id: 20, execution_sequence: 'order-1:fill-2' }), record({ id: 21 })],
  }), canonicalTest);
  assert.equal(await hashJournalRestorePayload(a), await hashJournalRestorePayload(b));

  const one = normalizeJournalRestoreBackup(backup({ records: [record()], cashEvents: [] }), canonicalTest);
  const two = normalizeJournalRestoreBackup(backup({
    records: [record(), record({ id: 2, created_at: '2026-08-01 12:00:01' })],
    cashEvents: [],
  }), canonicalTest);
  assert.notEqual(await hashJournalRestorePayload(one), await hashJournalRestorePayload(two));
});

test('D1 JSON chunking keeps every bound JSON array below the reviewed byte ceiling', () => {
  const rows = Array.from({ length: 800 }, (_, index) => ({ index, note: 'x'.repeat(2000) }));
  const chunks = restoreTest.splitJsonChunks(rows);
  assert.ok(chunks.length > 1);
  const decoded = chunks.flatMap(chunk => JSON.parse(chunk));
  assert.equal(decoded.length, rows.length);
  for (const chunk of chunks) {
    assert.ok(new TextEncoder().encode(chunk).byteLength <= restoreTest.MAX_D1_JSON_CHUNK_BYTES);
  }
});

test('empty-tenant restore is atomic, preserves duplicate multiplicity, and same-key replay is exactly once', async () => {
  const source = normalizeJournalRestoreBackup(backup({
    records: [record(), record({ id: 2, created_at: '2026-08-01 12:00:01' })],
  }), canonicalTest);
  const { db, state } = createRestoreDb();

  const first = await applyAtomicJournalRestore({ db, userId: USER, idempotencyKey: KEY_A, backup: source, canonicalTest });
  assert.equal(first.kind, 'restored');
  assert.deepEqual(first.counts, { records: 2, cash_events: 1 });
  assert.equal(state.records.length, 2);
  assert.equal(state.cashEvents.length, 1);
  assert.equal(state.sessions.length, 1);

  const replay = await applyAtomicJournalRestore({ db, userId: USER, idempotencyKey: KEY_A, backup: source, canonicalTest });
  assert.equal(replay.kind, 'replayed');
  assert.equal(state.records.length, 2);
  assert.equal(state.cashEvents.length, 1);
  assert.equal(state.sessions.length, 1);
});

test('non-empty destination and idempotency conflict fail closed instead of merging', async () => {
  const source = normalizeJournalRestoreBackup(backup(), canonicalTest);
  const occupied = createRestoreDb({ initialRecords: [{ user_id: USER, symbol: 'SPY' }] });
  const blocked = await applyAtomicJournalRestore({
    db: occupied.db,
    userId: USER,
    idempotencyKey: KEY_A,
    backup: source,
    canonicalTest,
  });
  assert.equal(blocked.kind, 'destination-not-empty');
  assert.equal(occupied.state.records.length, 1);
  assert.equal(occupied.state.sessions.length, 0);

  const fresh = createRestoreDb();
  assert.equal((await applyAtomicJournalRestore({
    db: fresh.db, userId: USER, idempotencyKey: KEY_A, backup: source, canonicalTest,
  })).kind, 'restored');
  const changed = normalizeJournalRestoreBackup(backup({ records: [record({ price: 101 })] }), canonicalTest);
  const conflict = await applyAtomicJournalRestore({
    db: fresh.db, userId: USER, idempotencyKey: KEY_A, backup: changed, canonicalTest,
  });
  assert.equal(conflict.kind, 'idempotency-conflict');
  assert.equal(fresh.state.records[0].price, 100);
});

test('any batch write failure rolls back the session guard and every live row', async () => {
  const source = normalizeJournalRestoreBackup(backup(), canonicalTest);
  const { db, state } = createRestoreDb({ failOnCash: true });
  await assert.rejects(
    applyAtomicJournalRestore({ db, userId: USER, idempotencyKey: KEY_A, backup: source, canonicalTest }),
    /synthetic cash insert failure/,
  );
  assert.equal(state.records.length, 0);
  assert.equal(state.cashEvents.length, 0);
  assert.equal(state.sessions.length, 0);
});

test('a different restore intent cannot append after the first restore commits', async () => {
  const source = normalizeJournalRestoreBackup(backup(), canonicalTest);
  const { db, state } = createRestoreDb();
  assert.equal((await applyAtomicJournalRestore({
    db, userId: USER, idempotencyKey: KEY_A, backup: source, canonicalTest,
  })).kind, 'restored');
  const second = await applyAtomicJournalRestore({
    db, userId: USER, idempotencyKey: KEY_B, backup: source, canonicalTest,
  });
  assert.equal(second.kind, 'destination-not-empty');
  assert.equal(state.records.length, 1);
  assert.equal(state.cashEvents.length, 1);
});

test('HTTP restore route requires user authentication and preserves preflight support', async () => {
  const env = {};
  const canonicalWorker = { fetch: async () => new Response('{}', { status: 401 }) };
  const options = new Request('https://api.example.test/api/journal-restore', {
    method: 'OPTIONS',
    headers: { Origin: 'https://allowed.example.test' },
  });
  const preflight = await tryHandleJournalRestore(options, env, null, {
    canonicalWorker,
    canonicalTest,
    isOriginAllowed: () => true,
  });
  assert.equal(preflight.status, 204);

  const unauthorized = await tryHandleJournalRestore(new Request('https://api.example.test/api/journal-restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup()),
  }), env, null, {
    canonicalWorker,
    canonicalTest,
    isOriginAllowed: () => true,
  });
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error_meta.code, 'UNAUTHORIZED');
});

test('deployment entry intercepts journal restore before the canonical route table', async () => {
  const entry = await readFile('worker-entry.js', 'utf8');
  assert.match(entry, /worker-journal-restore\.js/);
  assert.match(entry, /tryHandleJournalRestore/);
});
