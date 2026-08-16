import test from 'node:test';
import assert from 'node:assert/strict';

import { __test } from '../worker.js';

const USER = 'user@example.com';
const KEY = 'record.create.0123456789abcdef';
const BASE = Object.freeze({
  txn_date: '2026-08-12',
  symbol: 'DISK',
  txn_type: 'BUY',
  qty: 150,
  price: 33.99,
  fee: 0.855836,
  tax: 0,
  tag: 'Stock',
  note: 'user journal note',
});

function createDb() {
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
                  userId, txnDate, symbol, txnType, qty, price, fee, tax, tag, note,
                  currency, executedAt, executionSequence, eventSource,
                  idempotencyHash, payloadHash,
                ] = args;
                const existing = rows.find((row) => (
                  row.user_id === userId && row.create_idempotency_hash === idempotencyHash
                ));
                if (existing) return { meta: { changes: 0 } };
                rows.push({
                  id: nextId++, user_id: userId, txn_date: txnDate, symbol, txn_type: txnType,
                  qty, price, fee, tax, tag, note, currency, executed_at: executedAt,
                  execution_sequence: executionSequence, event_source: eventSource,
                  create_idempotency_hash: idempotencyHash, create_payload_hash: payloadHash,
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
                  id: nextId++, user_id: userId, txn_date: txnDate, symbol, txn_type: txnType,
                  qty, price, fee, tax, tag, note, currency, executed_at: executedAt,
                  execution_sequence: executionSequence, event_source: eventSource,
                  create_idempotency_hash: null, create_payload_hash: null,
                  created_at: '2026-08-12 00:00:00',
                });
                return { meta: { changes: 1 } };
              }

              if (normalized.startsWith('UPDATE records SET txn_date=')) {
                const [
                  txnDate, symbol, txnType, qty, price, fee, tax, tag, note,
                  currencyPresent, currency, currencyTxnDate, currencySymbol, currencyTxnType,
                  executedAtPresent, executedAt, executedTxnDate, executedSymbol, executedTxnType,
                  sequencePresent, executionSequence, sequenceTxnDate, sequenceSymbol, sequenceTxnType,
                  sourcePresent, eventSource, sourceTxnDate, sourceSymbol, sourceTxnType,
                  id, userId,
                ] = args;
                const row = rows.find((item) => item.id === id && item.user_id === userId);
                if (!row) return { meta: { changes: 0 } };
                for (const [date, currentSymbol, currentType] of [
                  [currencyTxnDate, currencySymbol, currencyTxnType],
                  [executedTxnDate, executedSymbol, executedTxnType],
                  [sequenceTxnDate, sequenceSymbol, sequenceTxnType],
                  [sourceTxnDate, sourceSymbol, sourceTxnType],
                ]) {
                  assert.equal(date, txnDate);
                  assert.equal(currentSymbol, symbol);
                  assert.equal(currentType, txnType);
                }
                const identityChanged = row.txn_date !== txnDate
                  || row.symbol !== symbol
                  || row.txn_type !== txnType;
                const resolve = (present, value, previous) => (
                  Number(present) === 1 ? value : (identityChanged ? null : previous)
                );
                Object.assign(row, {
                  txn_date: txnDate,
                  symbol,
                  txn_type: txnType,
                  qty,
                  price,
                  fee,
                  tax,
                  tag,
                  note,
                  currency: resolve(currencyPresent, currency, row.currency),
                  executed_at: resolve(executedAtPresent, executedAt, row.executed_at),
                  execution_sequence: resolve(sequencePresent, executionSequence, row.execution_sequence),
                  event_source: resolve(sourcePresent, eventSource, row.event_source),
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
              if (normalized.startsWith('SELECT txn_date, symbol, txn_type, currency, executed_at, execution_sequence, event_source FROM records')) {
                const [id, userId] = args;
                return rows.find((row) => row.id === id && row.user_id === userId) || null;
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

function putRequest(record) {
  return new Request('https://api.example.test/api/records', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
}

test('runtime version advances independently while physical schema authority remains 3', () => {
  assert.equal(__test.RELEASE_VERSION, '4.11');
  assert.equal(__test.API_VERSION, '2.64');
  assert.equal(__test.REQUIRED_SCHEMA_VERSION, 3);
});

test('metadata validation is authoritative, precision-safe, and preserves quote-unit semantics', () => {
  const legacy = __test.validateTransactionPayload({ ...BASE }, { requireId: false });
  assert.equal(legacy.currency, null);
  assert.equal(legacy.executed_at, null);
  assert.equal(legacy.execution_sequence, null);
  assert.equal(legacy.event_source, null);

  const value = __test.validateTransactionPayload({
    ...BASE,
    currency: 'GBp',
    executed_at: '2026-08-12T10:31:27.123456+08:00',
    execution_sequence: '487287953:1',
    event_source: 'ibkr',
  }, { requireId: false });
  assert.equal(value.currency, 'GBp');
  assert.equal(value.executed_at, '2026-08-12T10:31:27.123456+08:00');
  assert.equal(value.execution_sequence, '487287953:1');
  assert.equal(value.event_source, 'IBKR');

  assert.throws(() => __test.validateTransactionPayload({ ...BASE, currency: 'gbp' }, { requireId: false }), /currency/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, executed_at: '2026-08-12T10:31:27' }, { requireId: false }), /offset-aware/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, executed_at: '2026-02-30T10:31:27Z' }, { requireId: false }), /invalid/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, executed_at: '0000-01-01T00:00:00Z' }, { requireId: false }), /invalid/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, executed_at: '2026-08-12T10:31:27+14:30' }, { requireId: false }), /offset/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, execution_sequence: 487287953 }, { requireId: false }), /string/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, execution_sequence: 'fill 1' }, { requireId: false }), /execution_sequence/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, event_source: 'ibkr/account' }, { requireId: false }), /event_source/);
  assert.throws(() => __test.validateTransactionPayload({ ...BASE, event_source: 'ACCOUNT_123' }, { requireId: false }), /event_source/);
});

test('no-metadata create hash remains byte-compatible with the legacy nine-field material', async () => {
  const legacyCanonical = JSON.stringify([
    BASE.txn_date, BASE.symbol, BASE.txn_type, BASE.qty, BASE.price,
    BASE.fee, BASE.tax, BASE.tag, BASE.note,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(legacyCanonical));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  const absent = await __test.hashRecordCreatePayload({ ...BASE });
  const explicitNull = await __test.hashRecordCreatePayload({
    ...BASE, currency: null, executed_at: null, execution_sequence: null, event_source: null,
  });
  assert.equal(absent, expected);
  assert.equal(explicitNull, expected);
});

test('authoritative metadata participates in the versioned keyed-create fingerprint', async () => {
  const first = __test.validateTransactionPayload({
    ...BASE,
    currency: 'USD',
    executed_at: '2026-08-12T10:31:27+08:00',
    execution_sequence: '487287953:1',
    event_source: 'IBKR',
  }, { requireId: false });
  const changed = { ...first, executed_at: '2026-08-12T10:31:28+08:00' };
  const legacy = await __test.hashRecordCreatePayload(BASE);
  assert.notEqual(await __test.hashRecordCreatePayload(first), legacy);
  assert.notEqual(await __test.hashRecordCreatePayload(first), await __test.hashRecordCreatePayload(changed));
});

test('metadata persists in records, remains separate from note, and stays hidden only for internal hashes', async () => {
  const { db, rows } = createDb();
  const record = __test.validateTransactionPayload({
    ...BASE,
    currency: 'USD',
    executed_at: '2026-08-12T10:31:27+08:00',
    execution_sequence: '487287953:1',
    event_source: 'IBKR',
  }, { requireId: false });
  const idempotencyHash = await __test.hashRecordCreateIdempotency(USER, KEY);
  const payloadHash = await __test.hashRecordCreatePayload(record);
  const first = await __test.recordsRepository.insert(db, USER, record, { idempotencyHash, payloadHash });
  const replay = await __test.recordsRepository.insert(db, USER, record, { idempotencyHash, payloadHash });
  const changed = { ...record, execution_sequence: '487287953:2' };
  const conflict = await __test.recordsRepository.insert(db, USER, changed, {
    idempotencyHash,
    payloadHash: await __test.hashRecordCreatePayload(changed),
  });

  assert.equal(first.kind, 'inserted');
  assert.equal(replay.kind, 'replayed');
  assert.equal(conflict.kind, 'conflict');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].note, BASE.note);
  assert.equal(rows[0].currency, 'USD');
  assert.equal(rows[0].execution_sequence, '487287953:1');

  const projected = __test.publicRecord(rows[0]);
  assert.equal(projected.currency, 'USD');
  assert.equal(projected.executed_at, '2026-08-12T10:31:27+08:00');
  assert.equal(projected.execution_sequence, '487287953:1');
  assert.equal(projected.event_source, 'IBKR');
  assert.equal('create_idempotency_hash' in projected, false);
  assert.equal('create_payload_hash' in projected, false);
});

test('PUT preserves omitted metadata for same-event edits and supports explicit null clearing', async () => {
  const { db, rows } = createDb();
  const initial = __test.validateTransactionPayload({
    ...BASE,
    currency: 'USD',
    executed_at: '2026-08-12T10:31:27+08:00',
    execution_sequence: '487287953:1',
    event_source: 'IBKR',
  }, { requireId: false });
  await __test.recordsRepository.insert(db, USER, initial);

  const sameEvent = { ...BASE, id: 1, price: 34.25 };
  const response = await __test.handleUpdateRecord(
    putRequest(sameEvent), { DB: db }, { kind: 'user', email: USER }, 'same-event',
  );
  assert.equal(response.status, 200);
  assert.equal(rows[0].currency, 'USD');
  assert.equal(rows[0].executed_at, '2026-08-12T10:31:27+08:00');
  assert.equal(rows[0].execution_sequence, '487287953:1');
  assert.equal(rows[0].event_source, 'IBKR');

  const clearCurrency = await __test.handleUpdateRecord(
    putRequest({ ...sameEvent, currency: null }), { DB: db }, { kind: 'user', email: USER }, 'clear-currency',
  );
  assert.equal(clearCurrency.status, 200);
  assert.equal(rows[0].currency, null);
  assert.equal(rows[0].executed_at, '2026-08-12T10:31:27+08:00');
});

test('PUT clears omitted chronology/provenance when transaction event identity changes', async () => {
  const { db, rows } = createDb();
  const initial = __test.validateTransactionPayload({
    ...BASE,
    currency: 'USD',
    executed_at: '2026-08-12T10:31:27+08:00',
    execution_sequence: '487287953:1',
    event_source: 'IBKR',
  }, { requireId: false });
  await __test.recordsRepository.insert(db, USER, initial);

  const moved = await __test.handleUpdateRecord(
    putRequest({ ...BASE, id: 1, txn_date: '2026-08-13' }),
    { DB: db }, { kind: 'user', email: USER }, 'identity-change',
  );
  assert.equal(moved.status, 200);
  assert.equal(rows[0].txn_date, '2026-08-13');
  assert.equal(rows[0].currency, null);
  assert.equal(rows[0].executed_at, null);
  assert.equal(rows[0].execution_sequence, null);
  assert.equal(rows[0].event_source, null);

  const revalidated = await __test.handleUpdateRecord(
    putRequest({
      ...BASE,
      id: 1,
      txn_date: '2026-08-14',
      currency: 'GBp',
      executed_at: '2026-08-14T09:00:00Z',
      execution_sequence: 'order-2',
      event_source: 'MANUAL',
    }),
    { DB: db }, { kind: 'user', email: USER }, 'identity-revalidated',
  );
  assert.equal(revalidated.status, 200);
  assert.equal(rows[0].currency, 'GBp');
  assert.equal(rows[0].executed_at, '2026-08-14T09:00:00Z');
  assert.equal(rows[0].execution_sequence, 'order-2');
  assert.equal(rows[0].event_source, 'MANUAL');
});
