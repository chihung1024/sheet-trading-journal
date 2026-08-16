import test from 'node:test';
import assert from 'node:assert/strict';

import { __test } from '../worker.js';

const USER = 'user@example.com';
const OTHER_USER = 'other@example.com';
const BASE = Object.freeze({
  id: 7,
  txn_date: '2026-08-14',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 15,
  price: 103.33333333333333,
  fee: 1.5,
  tax: 0.1,
  currency: 'USD',
  executed_at: null,
  execution_sequence: 'IBKR-ORDER:487287953',
  event_source: 'IBKR',
});

function createDb(initial = {}) {
  const rows = [{
    id: BASE.id,
    user_id: USER,
    txn_date: BASE.txn_date,
    symbol: BASE.symbol,
    txn_type: BASE.txn_type,
    qty: BASE.qty,
    price: BASE.price,
    fee: BASE.fee,
    tax: BASE.tax,
    tag: 'Long-term',
    note: 'user journal note',
    currency: null,
    executed_at: null,
    execution_sequence: null,
    event_source: null,
    ...initial,
  }];

  return {
    rows,
    db: {
      prepare(sql) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        return {
          bind(...args) {
            return {
              async run() {
                if (!normalized.startsWith('UPDATE records SET currency=COALESCE')) {
                  throw new Error(`Unexpected run SQL: ${normalized}`);
                }
                const [
                  currency, executedAt, sequence, eventSource,
                  id, userId, txnDate, symbol, txnType, qty, price, fee, tax,
                ] = args;
                const desired = {
                  currency,
                  executed_at: executedAt,
                  execution_sequence: sequence,
                  event_source: eventSource,
                };
                const row = rows.find(candidate => candidate.id === id && candidate.user_id === userId);
                if (!row) return { meta: { changes: 0 } };
                const baseMatches = row.txn_date === txnDate
                  && row.symbol === symbol
                  && row.txn_type === txnType
                  && Number(row.qty) === qty
                  && Number(row.price) === price
                  && Number(row.fee) === fee
                  && Number(row.tax) === tax;
                if (!baseMatches) return { meta: { changes: 0 } };
                const conflicts = Object.entries(desired).some(([field, value]) => (
                  value !== null && row[field] !== null && row[field] !== value
                ));
                if (conflicts) return { meta: { changes: 0 } };
                const changes = Object.entries(desired).some(([field, value]) => value !== null && row[field] === null);
                if (!changes) return { meta: { changes: 0 } };
                for (const [field, value] of Object.entries(desired)) {
                  if (value !== null && row[field] === null) row[field] = value;
                }
                return { meta: { changes: 1 } };
              },
              async first() {
                if (!normalized.startsWith('SELECT id, txn_date, symbol, txn_type, qty, price, fee, tax, currency, executed_at, execution_sequence, event_source FROM records')) {
                  throw new Error(`Unexpected first SQL: ${normalized}`);
                }
                const [id, userId] = args;
                return rows.find(candidate => candidate.id === id && candidate.user_id === userId) || null;
              },
            };
          },
        };
      },
    },
  };
}

function requestFor(body) {
  return new Request('https://api.example.test/api/records/metadata', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('metadata enrichment validator accepts authoritative partial metadata and rejects empty enrichment', () => {
  const valid = __test.validateRecordMetadataEnrichmentPayload(BASE);
  assert.equal(valid.currency, 'USD');
  assert.equal(valid.execution_sequence, 'IBKR-ORDER:487287953');
  assert.equal(valid.event_source, 'IBKR');
  assert.equal(valid.executed_at, null);

  assert.throws(
    () => __test.validateRecordMetadataEnrichmentPayload({
      ...BASE,
      currency: null,
      executed_at: null,
      execution_sequence: null,
      event_source: null,
    }),
    /At least one authoritative metadata field is required/,
  );
});

test('metadata enrichment atomically fills only null metadata and leaves journal/base fields untouched', async () => {
  const { db, rows } = createDb();
  const result = await __test.recordsRepository.enrichMetadata(db, USER, BASE);

  assert.equal(result.kind, 'updated');
  assert.equal(rows[0].currency, 'USD');
  assert.equal(rows[0].execution_sequence, 'IBKR-ORDER:487287953');
  assert.equal(rows[0].event_source, 'IBKR');
  assert.equal(rows[0].executed_at, null);
  assert.equal(rows[0].tag, 'Long-term');
  assert.equal(rows[0].note, 'user journal note');
  assert.equal(rows[0].qty, BASE.qty);
});

test('same metadata enrichment is idempotent while different authoritative metadata fails closed', async () => {
  const { db, rows } = createDb();
  assert.equal((await __test.recordsRepository.enrichMetadata(db, USER, BASE)).kind, 'updated');
  assert.equal((await __test.recordsRepository.enrichMetadata(db, USER, BASE)).kind, 'unchanged');

  const conflict = await __test.recordsRepository.enrichMetadata(db, USER, {
    ...BASE,
    execution_sequence: 'IBKR-ORDER:DIFFERENT',
  });
  assert.equal(conflict.kind, 'metadata_conflict');
  assert.equal(rows[0].execution_sequence, BASE.execution_sequence);
});

test('economic amendment blocks enrichment without overwriting the amended record', async () => {
  const { db, rows } = createDb({ qty: 99 });
  const result = await __test.recordsRepository.enrichMetadata(db, USER, BASE);
  assert.equal(result.kind, 'record_conflict');
  assert.equal(rows[0].qty, 99);
  assert.equal(rows[0].currency, null);
});

test('metadata enrichment remains tenant scoped', async () => {
  const { db, rows } = createDb();
  const result = await __test.recordsRepository.enrichMetadata(db, OTHER_USER, BASE);
  assert.equal(result.kind, 'missing');
  assert.equal(rows[0].currency, null);
});

test('metadata endpoint classifies update, replay, conflicts and missing rows without changing base transaction', async () => {
  const { db, rows } = createDb();
  const principal = { kind: 'user', email: USER };

  const first = await __test.handleEnrichRecordMetadata(requestFor(BASE), { DB: db }, principal, 'first');
  assert.equal(first.status, 200);
  assert.equal((await first.json()).metadata_updated, true);

  const replay = await __test.handleEnrichRecordMetadata(requestFor(BASE), { DB: db }, principal, 'replay');
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).metadata_updated, false);

  const metadataConflict = await __test.handleEnrichRecordMetadata(
    requestFor({ ...BASE, event_source: 'IMPORT' }),
    { DB: db },
    principal,
    'metadata-conflict',
  );
  assert.equal(metadataConflict.status, 409);
  assert.equal((await metadataConflict.json()).error_meta.code, 'METADATA_CONFLICT');

  rows[0].price = 999;
  const changed = await __test.handleEnrichRecordMetadata(requestFor(BASE), { DB: db }, principal, 'changed');
  assert.equal(changed.status, 409);
  assert.equal((await changed.json()).error_meta.code, 'RECORD_CHANGED');

  const missing = await __test.handleEnrichRecordMetadata(
    requestFor({ ...BASE, id: 999 }),
    { DB: db },
    principal,
    'missing',
  );
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error_meta.code, 'RECORD_NOT_FOUND');
});

test('metadata endpoint keeps validation strict and route user-only', async () => {
  const { db } = createDb();
  const principal = { kind: 'user', email: USER };
  const invalidSource = await __test.handleEnrichRecordMetadata(
    requestFor({ ...BASE, event_source: 'ACCOUNT_U123' }),
    { DB: db },
    principal,
    'invalid-source',
  );
  assert.equal(invalidSource.status, 400);

  const invalidTime = await __test.handleEnrichRecordMetadata(
    requestFor({ ...BASE, executed_at: '2026-08-14T10:00:00' }),
    { DB: db },
    principal,
    'invalid-time',
  );
  assert.equal(invalidTime.status, 400);
});
