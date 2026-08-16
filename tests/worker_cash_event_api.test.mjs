import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { __test } from "../worker.js";

const USER = "cash-user@example.com";
const OTHER_USER = "cash-other@example.com";
const KEY_A = "cash.create.0123456789abcdef";
const KEY_B = "cash.create.fedcba9876543210";
const OPENING_USD = Object.freeze({
  event_date: "2026-01-01",
  event_type: "OPENING_BALANCE",
  amount: -250.25,
  currency: "USD",
  note: "margin baseline",
});
const DEPOSIT = Object.freeze({
  event_date: "2026-03-01",
  event_type: "DEPOSIT",
  amount: 1000,
  currency: "USD",
  note: "external funding",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createCashDb() {
  const rows = [];
  let nextId = 1;
  let clock = 0;
  const stamp = () => `2026-08-16 13:00:${String(clock++).padStart(2, "0")}`;

  const db = {
    touchedSql: [],
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      db.touchedSql.push(normalized);
      return {
        bind(...args) {
          return {
            async all() {
              if (normalized === "SELECT * FROM cash_events WHERE user_id = ? ORDER BY event_date DESC, id DESC") {
                const [userId] = args;
                return {
                  results: rows
                    .filter((row) => row.user_id === userId)
                    .sort((a, b) => b.event_date.localeCompare(a.event_date) || b.id - a.id)
                    .map(clone),
                };
              }
              throw new Error(`Unexpected all SQL: ${normalized}`);
            },
            async first() {
              if (normalized === "SELECT * FROM cash_events WHERE user_id = ? AND create_idempotency_hash = ? LIMIT 1") {
                const [userId, hash] = args;
                return clone(rows.find((row) => row.user_id === userId && row.create_idempotency_hash === hash) || null);
              }
              if (normalized === "SELECT * FROM cash_events WHERE id = ? AND user_id = ? LIMIT 1") {
                const [id, userId] = args;
                return clone(rows.find((row) => row.id === id && row.user_id === userId) || null);
              }
              if (normalized.startsWith("SELECT id FROM cash_events WHERE user_id = ? AND event_type = 'OPENING_BALANCE' AND currency = ?")) {
                const [userId, currency, excludeId] = args;
                const row = rows.find((item) => item.user_id === userId
                  && item.event_type === "OPENING_BALANCE"
                  && item.currency === currency
                  && (excludeId === undefined || item.id !== excludeId));
                return row ? { id: row.id } : null;
              }
              throw new Error(`Unexpected first SQL: ${normalized}`);
            },
            async run() {
              if (normalized.startsWith("INSERT OR IGNORE INTO cash_events")) {
                const [userId, eventDate, eventType, amount, currency, note, idempotencyHash, payloadHash] = args;
                const idem = rows.find((row) => row.user_id === userId && row.create_idempotency_hash === idempotencyHash);
                const opening = eventType === "OPENING_BALANCE"
                  ? rows.find((row) => row.user_id === userId && row.event_type === "OPENING_BALANCE" && row.currency === currency)
                  : null;
                if (idem || opening) return { meta: { changes: 0 } };
                const now = stamp();
                rows.push({
                  id: nextId++, user_id: userId, event_date: eventDate, event_type: eventType,
                  amount, currency, note, event_source: "MANUAL",
                  create_idempotency_hash: idempotencyHash, create_payload_hash: payloadHash,
                  created_at: now, updated_at: now,
                });
                return { meta: { changes: 1 } };
              }

              if (normalized.startsWith("UPDATE cash_events SET event_date = ?")) {
                const [
                  eventDate, eventType, amount, currency, note,
                  id, userId,
                  expectedDate, expectedType, expectedAmount, expectedCurrency, expectedNote,
                  guardType, guardUser, guardCurrency, guardId,
                ] = args;
                assert.equal(guardType, eventType);
                assert.equal(guardUser, userId);
                assert.equal(guardCurrency, currency);
                assert.equal(guardId, id);
                const row = rows.find((item) => item.id === id && item.user_id === userId);
                if (!row) return { meta: { changes: 0 } };
                const expectedMatches = row.event_date === expectedDate
                  && row.event_type === expectedType
                  && Number(row.amount) === Number(expectedAmount)
                  && row.currency === expectedCurrency
                  && row.note === expectedNote;
                if (!expectedMatches) return { meta: { changes: 0 } };
                const openingConflict = eventType === "OPENING_BALANCE" && rows.some((item) => (
                  item.user_id === userId && item.event_type === "OPENING_BALANCE"
                  && item.currency === currency && item.id !== id
                ));
                if (openingConflict) return { meta: { changes: 0 } };
                Object.assign(row, {
                  event_date: eventDate, event_type: eventType, amount, currency, note,
                  updated_at: stamp(),
                });
                return { meta: { changes: 1 } };
              }

              if (normalized.startsWith("DELETE FROM cash_events WHERE id = ? AND user_id = ?")) {
                const [id, userId, expectedDate, expectedType, expectedAmount, expectedCurrency, expectedNote] = args;
                const index = rows.findIndex((row) => row.id === id && row.user_id === userId
                  && row.event_date === expectedDate && row.event_type === expectedType
                  && Number(row.amount) === Number(expectedAmount) && row.currency === expectedCurrency
                  && row.note === expectedNote);
                if (index < 0) return { meta: { changes: 0 } };
                rows.splice(index, 1);
                return { meta: { changes: 1 } };
              }

              throw new Error(`Unexpected run SQL: ${normalized}`);
            },
          };
        },
      };
    },
  };
  return { db, rows };
}

function jsonRequest(method, body, key) {
  const headers = { "Content-Type": "application/json" };
  if (key !== undefined) headers["Idempotency-Key"] = key;
  return new Request("https://api.example.test/api/cash-events", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

async function createViaHandler(db, event, key = KEY_A, user = USER) {
  return __test.handleAddCashEvent(
    jsonRequest("POST", event, key),
    { DB: db },
    { kind: "user", email: user },
    `create-${key}`,
  );
}

test("R2.4B advances the read-only cash feed API while schema authority stays 3", async () => {
  assert.equal(__test.RELEASE_VERSION, "4.12");
  assert.equal(__test.API_VERSION, "2.65");
  assert.equal(__test.REQUIRED_SCHEMA_VERSION, 3);
  const worker = await readFile("worker.js", "utf8");
  assert.match(worker, /CORE_DATA_TABLES = \[[^\]]*"cash_events"/);
  const migration = await readFile("migrations/0005_cash_events_expand.sql", "utf8");
  assert.doesNotMatch(migration, /UPDATE schema_metadata/);
});

test("cash mutations remain user-only while GET permits trusted targeted system reads", () => {
  assert.equal(__test.authorize({ kind: "user" }, "GET /api/cash-events"), true);
  assert.equal(__test.authorize({ kind: "system" }, "GET /api/cash-events"), true);
  for (const route of [
    "POST /api/cash-events",
    "PUT /api/cash-events",
    "DELETE /api/cash-events",
  ]) {
    assert.equal(__test.authorize({ kind: "user" }, route), true);
    assert.equal(__test.authorize({ kind: "system" }, route), false);
  }
});

test("cash validation preserves signed opening balances and positive movement magnitudes", () => {
  assert.equal(__test.validateCashEventCreatePayload(OPENING_USD).amount, -250.25);
  assert.equal(__test.validateCashEventCreatePayload({ ...OPENING_USD, amount: 0 }).amount, 0);
  assert.equal(__test.validateCashEventCreatePayload(DEPOSIT).amount, 1000);
  assert.throws(
    () => __test.validateCashEventCreatePayload({ ...DEPOSIT, amount: 0 }),
    /greater than 0/,
  );
  assert.throws(
    () => __test.validateCashEventCreatePayload({ ...DEPOSIT, event_type: "WITHDRAWAL", amount: -1 }),
    /greater than 0/,
  );
  assert.throws(
    () => __test.validateCashEventCreatePayload({ ...DEPOSIT, currency: "GBp" }),
    /uppercase three-letter cash currency/,
  );
  assert.throws(
    () => __test.validateCashEventCreatePayload({ ...DEPOSIT, event_source: "IBKR" }),
    /event_source is not accepted/,
  );
  assert.throws(
    () => __test.validateCashEventCreatePayload({ ...DEPOSIT, user_id: OTHER_USER }),
    /user_id is not accepted/,
  );
});

test("cash create hashes are tenant-scoped, versioned, and payload-sensitive", async () => {
  const a = await __test.hashCashEventCreateIdempotency(USER, KEY_A);
  const replay = await __test.hashCashEventCreateIdempotency(USER, KEY_A);
  const other = await __test.hashCashEventCreateIdempotency(OTHER_USER, KEY_A);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, replay);
  assert.notEqual(a, other);
  assert.equal(await __test.hashCashEventCreatePayload(DEPOSIT), await __test.hashCashEventCreatePayload({ ...DEPOSIT }));
  assert.notEqual(await __test.hashCashEventCreatePayload(DEPOSIT), await __test.hashCashEventCreatePayload({ ...DEPOSIT, amount: 1001 }));
});

test("POST requires durable idempotency, replays exactly once, and hides internal hashes", async () => {
  const { db, rows } = createCashDb();
  const missingKey = await __test.handleAddCashEvent(
    jsonRequest("POST", DEPOSIT),
    { DB: db },
    { kind: "user", email: USER },
    "missing-key",
  );
  assert.equal(missingKey.status, 400);
  assert.equal((await missingKey.json()).error_meta.code, "INVALID_REQUEST");

  const first = await createViaHandler(db, DEPOSIT, KEY_A);
  const replay = await createViaHandler(db, DEPOSIT, KEY_A);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  const firstBody = await first.json();
  const replayBody = await replay.json();
  assert.equal(firstBody.deduplicated, false);
  assert.equal(replayBody.deduplicated, true);
  assert.equal(firstBody.cash_event.id, replayBody.cash_event.id);
  assert.equal(firstBody.cash_event.event_source, "MANUAL");
  assert.equal("user_id" in firstBody.cash_event, false);
  assert.equal("create_idempotency_hash" in firstBody.cash_event, false);
  assert.equal("create_payload_hash" in firstBody.cash_event, false);
  assert.equal(rows.length, 1);

  const conflict = await createViaHandler(db, { ...DEPOSIT, amount: 1001 }, KEY_A);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error_meta.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(rows.length, 1);
});

test("opening balance uniqueness is tenant/currency scoped and a different create intent fails closed", async () => {
  const { db, rows } = createCashDb();
  assert.equal((await createViaHandler(db, OPENING_USD, KEY_A)).status, 201);
  const second = await createViaHandler(db, { ...OPENING_USD, amount: 500 }, KEY_B);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error_meta.code, "OPENING_BALANCE_EXISTS");
  assert.equal((await createViaHandler(db, { ...OPENING_USD, currency: "EUR", amount: 0 }, KEY_B)).status, 201);
  assert.equal((await createViaHandler(db, OPENING_USD, KEY_A, OTHER_USER)).status, 201);
  assert.equal(rows.length, 3);
});

test("GET is tenant-isolated and deterministic without treating database time as financial chronology", async () => {
  const { db } = createCashDb();
  await createViaHandler(db, DEPOSIT, KEY_A);
  await createViaHandler(db, { ...DEPOSIT, event_date: "2026-04-01", amount: 200 }, KEY_B);
  await createViaHandler(db, { ...DEPOSIT, amount: 300 }, KEY_A, OTHER_USER);
  const response = await __test.handleGetCashEvents({ DB: db }, { kind: "user", email: USER }, "get");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.cash_events.length, 2);
  assert.deepEqual(body.cash_events.map((event) => event.amount), [200, 1000]);
  assert.ok(body.cash_events.every((event) => !("user_id" in event)));
});

test("PUT uses exact expected state, rejects stale edits, and preserves server provenance", async () => {
  const { db, rows } = createCashDb();
  const created = await (await createViaHandler(db, DEPOSIT, KEY_A)).json();
  const original = created.cash_event;
  const desired = { ...DEPOSIT, amount: 1200, note: "amended funding" };
  const updated = await __test.handleUpdateCashEvent(
    jsonRequest("PUT", { id: original.id, expected: DEPOSIT, event: desired }),
    { DB: db },
    { kind: "user", email: USER },
    "update",
  );
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.updated, true);
  assert.equal(updatedBody.cash_event.amount, 1200);
  assert.equal(updatedBody.cash_event.event_source, "MANUAL");

  const stale = await __test.handleUpdateCashEvent(
    jsonRequest("PUT", { id: original.id, expected: DEPOSIT, event: { ...desired, amount: 1300 } }),
    { DB: db },
    { kind: "user", email: USER },
    "stale",
  );
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error_meta.code, "CASH_EVENT_CHANGED");
  assert.equal(rows[0].amount, 1200);
});

test("PUT cannot create a second opening balance in the same tenant/currency", async () => {
  const { db } = createCashDb();
  const opening = await (await createViaHandler(db, OPENING_USD, KEY_A)).json();
  const deposit = await (await createViaHandler(db, { ...DEPOSIT, currency: "USD" }, KEY_B)).json();
  const response = await __test.handleUpdateCashEvent(
    jsonRequest("PUT", {
      id: deposit.cash_event.id,
      expected: DEPOSIT,
      event: { ...OPENING_USD, event_date: DEPOSIT.event_date, amount: 50 },
    }),
    { DB: db },
    { kind: "user", email: USER },
    "opening-conflict",
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error_meta.code, "OPENING_BALANCE_EXISTS");
  assert.ok(opening.cash_event.id !== deposit.cash_event.id);
});

test("DELETE uses expected state so stale UI cannot delete a concurrently amended cash event", async () => {
  const { db, rows } = createCashDb();
  const created = await (await createViaHandler(db, DEPOSIT, KEY_A)).json();
  const id = created.cash_event.id;
  const changed = { ...DEPOSIT, amount: 1500 };
  const update = await __test.handleUpdateCashEvent(
    jsonRequest("PUT", { id, expected: DEPOSIT, event: changed }),
    { DB: db },
    { kind: "user", email: USER },
    "update-before-delete",
  );
  assert.equal(update.status, 200);

  const staleDelete = await __test.handleDeleteCashEvent(
    jsonRequest("DELETE", { id, expected: DEPOSIT }),
    { DB: db },
    { kind: "user", email: USER },
    "stale-delete",
  );
  assert.equal(staleDelete.status, 409);
  assert.equal((await staleDelete.json()).error_meta.code, "CASH_EVENT_CHANGED");
  assert.equal(rows.length, 1);

  const deleteResponse = await __test.handleDeleteCashEvent(
    jsonRequest("DELETE", { id, expected: changed }),
    { DB: db },
    { kind: "user", email: USER },
    "delete",
  );
  assert.equal(deleteResponse.status, 200);
  assert.equal(rows.length, 0);
  assert.ok(db.touchedSql.every((sql) => !/portfolio_snapshots|calculation_jobs/i.test(sql)));
});

test("cross-tenant update and delete classify as not found without leaking another tenant row", async () => {
  const { db, rows } = createCashDb();
  const created = await (await createViaHandler(db, DEPOSIT, KEY_A, OTHER_USER)).json();
  const id = created.cash_event.id;
  const update = await __test.handleUpdateCashEvent(
    jsonRequest("PUT", { id, expected: DEPOSIT, event: { ...DEPOSIT, amount: 2 } }),
    { DB: db },
    { kind: "user", email: USER },
    "cross-update",
  );
  assert.equal(update.status, 404);
  assert.equal((await update.json()).error_meta.code, "CASH_EVENT_NOT_FOUND");
  const deletion = await __test.handleDeleteCashEvent(
    jsonRequest("DELETE", { id, expected: DEPOSIT }),
    { DB: db },
    { kind: "user", email: USER },
    "cross-delete",
  );
  assert.equal(deletion.status, 404);
  assert.equal(rows.length, 1);
});


test("cash-event GET authorizes tenant user and trusted system while mutations stay user-only", () => {
  assert.equal(__test.authorize({ kind: "user" }, "GET /api/cash-events"), true);
  assert.equal(__test.authorize({ kind: "system" }, "GET /api/cash-events"), true);
  for (const method of ["POST", "PUT", "DELETE"]) {
    assert.equal(__test.authorize({ kind: "system" }, `${method} /api/cash-events`), false);
  }
});

test("system cash-event GET requires explicit target and returns only target public rows", async () => {
  const rows = [{
    id: 91,
    user_id: "target@example.com",
    event_date: "2026-08-01",
    event_type: "OPENING_BALANCE",
    amount: 125,
    currency: "USD",
    note: "private note",
    event_source: "MANUAL",
    create_idempotency_hash: "a".repeat(64),
    create_payload_hash: "b".repeat(64),
    created_at: "2026-08-01 00:00:00",
    updated_at: "2026-08-01 00:00:00",
  }];
  const seen = [];
  const env = { DB: { prepare(sql) { return { bind(userId) { seen.push(userId); return { async all() { return { results: rows }; } }; } }; } } };

  const missing = await __test.handleGetCashEvents(
    env,
    { kind: "system" },
    "req-missing",
  );
  assert.equal(missing.status, 400);
  const missingPayload = await missing.json();
  assert.equal(missingPayload.error_meta.code, "INVALID_REQUEST");
  assert.equal(seen.length, 0);

  const invalid = await __test.handleGetCashEvents(
    env,
    { kind: "system" },
    "req-invalid",
    "not-an-email",
  );
  assert.equal(invalid.status, 400);
  assert.equal(seen.length, 0);

  const response = await __test.handleGetCashEvents(
    env,
    { kind: "system" },
    "req-system",
    "target@example.com",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ["target@example.com"]);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.cash_events.length, 1);
  assert.equal("user_id" in payload.cash_events[0], false);
  assert.equal("create_idempotency_hash" in payload.cash_events[0], false);
  assert.equal("create_payload_hash" in payload.cash_events[0], false);
});

test("tenant cash-event GET remains pinned to authenticated owner even if target header is supplied", async () => {
  const seen = [];
  const env = { DB: { prepare() { return { bind(userId) { seen.push(userId); return { async all() { return { results: [] }; } }; } }; } } };
  const response = await __test.handleGetCashEvents(
    env,
    { kind: "user", email: "owner@example.com" },
    "req-user",
    "other@example.com",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ["owner@example.com"]);
});
