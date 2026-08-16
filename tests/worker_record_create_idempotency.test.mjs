import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { __test } from '../worker.js';

const USER = 'user@example.com';
const OTHER_USER = 'other@example.com';
const KEY_A = 'record.create.0123456789abcdef';
const KEY_B = 'record.create.fedcba9876543210';

const BASE_RECORD = Object.freeze({
  txn_date: '2026-08-12',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 2,
  price: 180.5,
  fee: 1.25,
  tax: 0,
  tag: 'Stock',
  note: 'idempotency regression',
});

function createRecordsDb() {
  const rows = [];
  let nextId = 1;

  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async run() {
              if (normalized.startsWith('INSERT OR IGNORE INTO records')) {
                const [
                  userId,
                  txnDate,
                  symbol,
                  txnType,
                  qty,
                  price,
                  fee,
                  tax,
                  tag,
                  note,
                  currency,
                  executedAt,
                  executionSequence,
                  eventSource,
                  idempotencyHash,
                  payloadHash,
                ] = args;
                const existing = rows.find((row) => (
                  row.user_id === userId && row.create_idempotency_hash === idempotencyHash
                ));
                if (existing) return { meta: { changes: 0 } };
                rows.push({
                  id: nextId++,
                  user_id: userId,
                  txn_date: txnDate,
                  symbol,
                  txn_type: txnType,
                  qty,
                  price,
                  fee,
                  tax,
                  tag,
                  note,
                  currency,
                  executed_at: executedAt,
                  execution_sequence: executionSequence,
                  event_source: eventSource,
                  create_idempotency_hash: idempotencyHash,
                  create_payload_hash: payloadHash,
                  created_at: '2026-08-12 00:00:00',
                });
                return { meta: { changes: 1 } };
              }

              if (normalized.startsWith('INSERT INTO records')) {
                const [
                  userId, txnDate, symbol, txnType, qty, price, fee, tax, tag, note,
                  currency, executedAt, executionSequence, eventSource,
                ] = args;
                rows.push({
                  id: nextId++,
                  user_id: userId,
                  txn_date: txnDate,
                  symbol,
                  txn_type: txnType,
                  qty,
                  price,
                  fee,
                  tax,
                  tag,
                  note,
                  currency,
                  executed_at: executedAt,
                  execution_sequence: executionSequence,
                  event_source: eventSource,
                  create_idempotency_hash: null,
                  create_payload_hash: null,
                  created_at: '2026-08-12 00:00:00',
                });
                return { meta: { changes: 1 } };
              }

              throw new Error(`Unexpected run SQL: ${normalized}`);
            },
            async first() {
              if (normalized.startsWith('SELECT id, create_payload_hash FROM records')) {
                const [userId, idempotencyHash] = args;
                return rows.find((row) => (
                  row.user_id === userId && row.create_idempotency_hash === idempotencyHash
                )) || null;
              }
              throw new Error(`Unexpected first SQL: ${normalized}`);
            },
          };
        },
      };
    },
  };

  return { db, rows };
}

function requestFor(record, idempotencyKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
  return new Request('https://api.example.test/api/records', {
    method: 'POST',
    headers,
    body: JSON.stringify(record),
  });
}

test('migration 0003 is additive, tenant-scoped, and advances only schema 2 to 3', async () => {
  const migration = await readFile('migrations/0003_record_create_idempotency.sql', 'utf8');
  assert.match(migration, /ALTER TABLE records ADD COLUMN create_idempotency_hash TEXT/);
  assert.match(migration, /ALTER TABLE records ADD COLUMN create_payload_hash TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_records_user_create_idempotency/);
  assert.match(migration, /ON records \(user_id, create_idempotency_hash\)/);
  assert.match(migration, /schema_version = 3/);
  assert.match(migration, /release_version = '4\.08'/);
  assert.match(migration, /WHERE id = 1 AND schema_version = 2/);
});

test('record-create idempotency hash is tenant scoped and payload hash is intent sensitive', async () => {
  const userA = await __test.hashRecordCreateIdempotency(USER, KEY_A);
  const userAReplay = await __test.hashRecordCreateIdempotency(USER, KEY_A);
  const userB = await __test.hashRecordCreateIdempotency(OTHER_USER, KEY_A);
  assert.match(userA, /^[0-9a-f]{64}$/);
  assert.equal(userA, userAReplay);
  assert.notEqual(userA, userB);

  const firstPayload = await __test.hashRecordCreatePayload(BASE_RECORD);
  const samePayload = await __test.hashRecordCreatePayload({ ...BASE_RECORD });
  const changedPayload = await __test.hashRecordCreatePayload({ ...BASE_RECORD, price: 181 });
  assert.equal(firstPayload, samePayload);
  assert.notEqual(firstPayload, changedPayload);
});

test('same tenant + same key + same payload is exactly-once while a different key may create an identical legitimate trade', async () => {
  const { db, rows } = createRecordsDb();
  const payloadHash = await __test.hashRecordCreatePayload(BASE_RECORD);
  const hashA = await __test.hashRecordCreateIdempotency(USER, KEY_A);
  const hashB = await __test.hashRecordCreateIdempotency(USER, KEY_B);

  const first = await __test.recordsRepository.insert(db, USER, BASE_RECORD, {
    idempotencyHash: hashA,
    payloadHash,
  });
  const replay = await __test.recordsRepository.insert(db, USER, BASE_RECORD, {
    idempotencyHash: hashA,
    payloadHash,
  });
  const independentIntent = await __test.recordsRepository.insert(db, USER, BASE_RECORD, {
    idempotencyHash: hashB,
    payloadHash,
  });

  assert.equal(first.kind, 'inserted');
  assert.equal(replay.kind, 'replayed');
  assert.equal(replay.record.id, first.record.id);
  assert.equal(independentIntent.kind, 'inserted');
  assert.notEqual(independentIntent.record.id, first.record.id);
  assert.equal(rows.length, 2);
});

test('same tenant + same key + different payload fails closed instead of silently deduplicating', async () => {
  const { db, rows } = createRecordsDb();
  const idempotencyHash = await __test.hashRecordCreateIdempotency(USER, KEY_A);
  const firstPayloadHash = await __test.hashRecordCreatePayload(BASE_RECORD);
  const changed = { ...BASE_RECORD, qty: 3 };
  const changedPayloadHash = await __test.hashRecordCreatePayload(changed);

  await __test.recordsRepository.insert(db, USER, BASE_RECORD, {
    idempotencyHash,
    payloadHash: firstPayloadHash,
  });
  const conflict = await __test.recordsRepository.insert(db, USER, changed, {
    idempotencyHash,
    payloadHash: changedPayloadHash,
  });

  assert.equal(conflict.kind, 'conflict');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 2);
});

test('same key is independent across tenants', async () => {
  const { db, rows } = createRecordsDb();
  const payloadHash = await __test.hashRecordCreatePayload(BASE_RECORD);
  const userHash = await __test.hashRecordCreateIdempotency(USER, KEY_A);
  const otherHash = await __test.hashRecordCreateIdempotency(OTHER_USER, KEY_A);

  assert.equal((await __test.recordsRepository.insert(db, USER, BASE_RECORD, {
    idempotencyHash: userHash,
    payloadHash,
  })).kind, 'inserted');
  assert.equal((await __test.recordsRepository.insert(db, OTHER_USER, BASE_RECORD, {
    idempotencyHash: otherHash,
    payloadHash,
  })).kind, 'inserted');
  assert.equal(rows.length, 2);
});

test('POST /api/records remains backward compatible without a key and deduplicates keyed replay', async () => {
  const { db, rows } = createRecordsDb();
  const principal = { kind: 'user', email: USER };

  const legacyA = await __test.handleAddRecord(requestFor(BASE_RECORD), { DB: db }, principal, 'legacy-a');
  const legacyB = await __test.handleAddRecord(requestFor(BASE_RECORD), { DB: db }, principal, 'legacy-b');
  assert.equal(legacyA.status, 200);
  assert.equal(legacyB.status, 200);
  assert.equal(rows.length, 2);

  const keyedA = await __test.handleAddRecord(requestFor(BASE_RECORD, KEY_A), { DB: db }, principal, 'keyed-a');
  const keyedB = await __test.handleAddRecord(requestFor(BASE_RECORD, KEY_A), { DB: db }, principal, 'keyed-b');
  assert.equal(keyedA.status, 200);
  assert.equal(keyedB.status, 200);
  assert.equal((await keyedA.json()).deduplicated, false);
  assert.equal((await keyedB.json()).deduplicated, true);
  assert.equal(rows.length, 3);
});

test('POST /api/records returns 409 when a key is reused for a different validated payload', async () => {
  const { db, rows } = createRecordsDb();
  const principal = { kind: 'user', email: USER };

  const first = await __test.handleAddRecord(requestFor(BASE_RECORD, KEY_A), { DB: db }, principal, 'first');
  assert.equal(first.status, 200);

  const conflict = await __test.handleAddRecord(
    requestFor({ ...BASE_RECORD, price: 999 }, KEY_A),
    { DB: db },
    principal,
    'conflict',
  );
  assert.equal(conflict.status, 409);
  const body = await conflict.json();
  assert.equal(body.error_meta.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, BASE_RECORD.price);
});

test('internal idempotency hashes are never exposed by the public record projection', () => {
  const projected = __test.publicRecord({
    id: 1,
    user_id: USER,
    txn_date: BASE_RECORD.txn_date,
    symbol: BASE_RECORD.symbol,
    txn_type: BASE_RECORD.txn_type,
    qty: BASE_RECORD.qty,
    price: BASE_RECORD.price,
    fee: BASE_RECORD.fee,
    tax: BASE_RECORD.tax,
    tag: BASE_RECORD.tag,
    note: BASE_RECORD.note,
    create_idempotency_hash: 'a'.repeat(64),
    create_payload_hash: 'b'.repeat(64),
  });
  assert.equal('create_idempotency_hash' in projected, false);
  assert.equal('create_payload_hash' in projected, false);
  assert.equal(projected.symbol, 'NVDA');
});
