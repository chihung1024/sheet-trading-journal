import assert from 'node:assert/strict';
import test from 'node:test';

import { __test as canonicalTest } from '../worker.js';
import {
  buildDividendEventIdempotencyKey,
} from '../shared/dividendEventIdentity.js';
import {
  ensureDividendEventRecord,
  tryHandleDividendEventCreate,
} from '../worker-dividend-event.js';

const USER = 'user@example.com';
const OTHER_USER = 'other@example.com';
const BASE_RECORD = Object.freeze({
  txn_date: '2026-08-15',
  symbol: 'NVDA',
  txn_type: 'DIV',
  qty: 1,
  price: 12.34,
  fee: 0,
  tax: 0,
  tag: 'Auto-Dividend',
  note: '稅金:USD 2.00',
});

const changes = value => ({ meta: { changes: value } });

function createDividendDb(seedRows = []) {
  const rows = seedRows.map(row => ({ ...row }));
  let nextId = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
  let batchTail = Promise.resolve();

  const executeRun = async (sql, args) => {
    if (sql.startsWith('UPDATE records SET create_idempotency_hash = NULL')) {
      const [userId, idempotencyHash, symbol, txnDate] = args;
      let count = 0;
      for (const row of rows) {
        if (
          row.user_id === userId
          && row.create_idempotency_hash === idempotencyHash
          && !(row.txn_type === 'DIV' && row.symbol === symbol && row.txn_date === txnDate)
        ) {
          row.create_idempotency_hash = null;
          row.create_payload_hash = null;
          count += 1;
        }
      }
      return changes(count);
    }

    if (sql.startsWith('INSERT OR IGNORE INTO records')) {
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
        idempotencyHash,
        payloadHash,
        eventUser,
        eventSymbol,
        eventDate,
      ] = args;
      const eventExists = rows.some(row => (
        row.user_id === eventUser
        && row.txn_type === 'DIV'
        && row.symbol === eventSymbol
        && row.txn_date === eventDate
      ));
      const keyExists = rows.some(row => (
        row.user_id === userId && row.create_idempotency_hash === idempotencyHash
      ));
      if (eventExists || keyExists) return changes(0);

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
        create_idempotency_hash: idempotencyHash,
        create_payload_hash: payloadHash,
      });
      return changes(1);
    }

    throw new Error(`Unexpected run SQL: ${sql}`);
  };

  const executeAll = async (sql, args) => {
    if (sql.startsWith('SELECT id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note FROM records')) {
      const [userId, symbol, txnDate] = args;
      return {
        results: rows
          .filter(row => (
            row.user_id === userId
            && row.txn_type === 'DIV'
            && row.symbol === symbol
            && row.txn_date === txnDate
          ))
          .sort((left, right) => Number(left.id) - Number(right.id))
          .map(row => ({ ...row })),
      };
    }
    throw new Error(`Unexpected all SQL: ${sql}`);
  };

  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            run: () => executeRun(normalized, args),
            all: () => executeAll(normalized, args),
          };
        },
      };
    },
    batch(statements) {
      const execute = async () => {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      };
      const result = batchTail.then(execute, execute);
      batchTail = result.then(() => undefined, () => undefined);
      return result;
    },
  };

  return { db, rows };
}

const semanticKeyFor = record => buildDividendEventIdempotencyKey({
  symbol: record.symbol,
  date: record.txn_date,
});

const ensure = async (db, user, record) => ensureDividendEventRecord(
  db,
  user,
  record,
  await semanticKeyFor(record),
  canonicalTest,
);

function requestFor(record, key) {
  return new Request('https://api.example.test/api/records/idempotent', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer verified-test-token',
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      Origin: 'https://sheet-trading-journal.pages.dev',
    },
    body: JSON.stringify(record),
  });
}

const verifiedCanonicalWorker = Object.freeze({
  async fetch(request) {
    if (new URL(request.url).pathname !== '/auth/google') {
      throw new Error('Only the internal auth exchange is expected');
    }
    return new Response(JSON.stringify({ success: true, email: USER }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

test('same dividend event and payload is exactly-once across independent create attempts', async () => {
  const { db, rows } = createDividendDb();
  const [left, right] = await Promise.all([
    ensure(db, USER, BASE_RECORD),
    ensure(db, USER, { ...BASE_RECORD }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(Number(left.inserted) + Number(right.inserted), 1);
  assert.equal(left.payloadMatched, true);
  assert.equal(right.payloadMatched, true);
  assert.equal(left.recordId, right.recordId);
});

test('same event with different payload never creates a second row', async () => {
  const { db, rows } = createDividendDb();
  const first = await ensure(db, USER, BASE_RECORD);
  const changed = await ensure(db, USER, { ...BASE_RECORD, price: 99.99, note: '' });

  assert.equal(first.inserted, true);
  assert.equal(changed.inserted, false);
  assert.equal(changed.payloadMatched, false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, BASE_RECORD.price);
});

test('an existing manual DIV confirms the semantic event without adding another automatic row', async () => {
  const { db, rows } = createDividendDb([{
    id: 41,
    user_id: USER,
    ...BASE_RECORD,
    price: 8.5,
    tag: 'Manual',
    note: 'broker statement',
    create_idempotency_hash: null,
    create_payload_hash: null,
  }]);

  const result = await ensure(db, USER, BASE_RECORD);
  assert.equal(result.inserted, false);
  assert.equal(result.payloadMatched, false);
  assert.equal(result.recordId, 41);
  assert.equal(rows.length, 1);
});

test('editing the deterministic-key row away from its event releases only that stale semantic reservation', async () => {
  const { db, rows } = createDividendDb();
  const first = await ensure(db, USER, BASE_RECORD);
  assert.equal(first.inserted, true);
  const originalHash = rows[0].create_idempotency_hash;

  rows[0].symbol = 'AMD';
  rows[0].txn_date = '2026-08-14';
  const second = await ensure(db, USER, BASE_RECORD);

  assert.equal(second.inserted, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].create_idempotency_hash, null);
  assert.equal(rows[0].create_payload_hash, null);
  assert.equal(rows[1].symbol, 'NVDA');
  assert.equal(rows[1].txn_date, '2026-08-15');
  assert.equal(rows[1].create_idempotency_hash, originalHash);
});

test('deleting a confirmed dividend releases the row-backed reservation and allows a later reconfirmation', async () => {
  const { db, rows } = createDividendDb();
  const first = await ensure(db, USER, BASE_RECORD);
  assert.equal(first.inserted, true);
  rows.splice(0, rows.length);

  const second = await ensure(db, USER, BASE_RECORD);
  assert.equal(second.inserted, true);
  assert.equal(rows.length, 1);
  assert.notEqual(second.recordId, first.recordId);
});

test('tenant and event boundaries remain independent', async () => {
  const { db, rows } = createDividendDb();
  const nextDate = { ...BASE_RECORD, txn_date: '2026-08-16' };

  assert.equal((await ensure(db, USER, BASE_RECORD)).inserted, true);
  assert.equal((await ensure(db, OTHER_USER, BASE_RECORD)).inserted, true);
  assert.equal((await ensure(db, USER, nextDate)).inserted, true);
  assert.equal(rows.length, 3);
});

test('semantic HTTP path returns replay success for exact payload and conflict for a different amount', async () => {
  const { db, rows } = createDividendDb();
  const key = await semanticKeyFor(BASE_RECORD);
  const deps = {
    canonicalWorker: verifiedCanonicalWorker,
    canonicalTest,
    isOriginAllowed: () => true,
  };

  const first = await tryHandleDividendEventCreate(requestFor(BASE_RECORD, key), { DB: db }, {}, deps);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).deduplicated, false);

  const replay = await tryHandleDividendEventCreate(requestFor(BASE_RECORD, key), { DB: db }, {}, deps);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).deduplicated, true);

  const conflict = await tryHandleDividendEventCreate(
    requestFor({ ...BASE_RECORD, price: 15.5, note: '' }, key),
    { DB: db },
    {},
    deps,
  );
  assert.equal(conflict.status, 409);
  const body = await conflict.json();
  assert.equal(body.error_meta.code, 'DIVIDEND_EVENT_CONFLICT');
  assert.equal(rows.length, 1);
});

test('reserved dividend key must match the validated Symbol + Date event and invalid auth falls back to canonical handling', async () => {
  const { db, rows } = createDividendDb();
  const wrongKey = await buildDividendEventIdempotencyKey({ symbol: 'AMD', date: BASE_RECORD.txn_date });
  const deps = {
    canonicalWorker: verifiedCanonicalWorker,
    canonicalTest,
    isOriginAllowed: () => true,
  };

  const mismatch = await tryHandleDividendEventCreate(
    requestFor(BASE_RECORD, wrongKey),
    { DB: db },
    {},
    deps,
  );
  assert.equal(mismatch.status, 400);
  assert.equal((await mismatch.json()).error_meta.code, 'INVALID_DIVIDEND_EVENT_REQUEST');
  assert.equal(rows.length, 0);

  const rejectedAuth = await tryHandleDividendEventCreate(
    requestFor(BASE_RECORD, await semanticKeyFor(BASE_RECORD)),
    { DB: db },
    {},
    {
      ...deps,
      canonicalWorker: {
        fetch: async () => new Response(JSON.stringify({ success: false }), { status: 401 }),
      },
    },
  );
  assert.equal(rejectedAuth, null);
  assert.equal(rows.length, 0);
});
