import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "../worker.js";

const USER = { kind: "user", email: "user@example.com" };

function makeAtomicDeleteDb(batchResults) {
  const calls = [];
  const batched = [];
  return {
    calls,
    batched,
    prepare(sql) {
      const call = { sql, binds: [] };
      calls.push(call);
      return {
        bind(...args) {
          call.binds = args;
          return this;
        },
      };
    },
    async batch(statements) {
      batched.push(statements);
      if (batchResults instanceof Error) throw batchResults;
      return batchResults;
    },
  };
}

function successBatch({ deleted = 1, remaining = 1, snapshotsDeleted = 0 } = {}) {
  return [
    { meta: { changes: snapshotsDeleted } },
    { meta: { changes: deleted } },
    { results: [{ total: remaining }], meta: { changes: 0 } },
  ];
}

function deleteRequest(id = 7) {
  return new Request("https://api.example.test/api/records", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

test("atomic record delete uses one D1 batch with guarded snapshot cleanup", async () => {
  const DB = makeAtomicDeleteDb(successBatch({ deleted: 1, remaining: 2 }));

  const result = await __test.recordsRepository.deleteAtomic(DB, USER.email, 7);

  assert.deepEqual(result, { changed: 1, remaining: 2 });
  assert.equal(DB.calls.length, 3);
  assert.equal(DB.batched.length, 1);
  assert.equal(DB.batched[0].length, 3);

  assert.match(DB.calls[0].sql, /DELETE FROM portfolio_snapshots/);
  assert.match(DB.calls[0].sql, /EXISTS\s*\(\s*SELECT 1 FROM records WHERE id = \? AND user_id = \?/s);
  assert.match(DB.calls[0].sql, /NOT EXISTS\s*\(\s*SELECT 1 FROM records WHERE user_id = \? AND id <> \?/s);
  assert.deepEqual(DB.calls[0].binds, [USER.email, 7, USER.email, USER.email, 7]);

  assert.match(DB.calls[1].sql, /DELETE FROM records WHERE id = \? AND user_id = \?/);
  assert.deepEqual(DB.calls[1].binds, [7, USER.email]);

  assert.match(DB.calls[2].sql, /SELECT COUNT\(\*\) AS total FROM records WHERE user_id = \?/);
  assert.deepEqual(DB.calls[2].binds, [USER.email]);
});

test("missing record remains a definite 404 without unguarded snapshot cleanup", async () => {
  const DB = makeAtomicDeleteDb(successBatch({ deleted: 0, remaining: 3 }));

  const response = await __test.handleDeleteRecord(deleteRequest(999), { DB }, USER, "req-missing");
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error_meta.code, "NOT_FOUND");
  assert.equal(DB.batched.length, 1);
});

test("last-record delete reports RELOAD_UI from the same atomic batch", async () => {
  const DB = makeAtomicDeleteDb(successBatch({ deleted: 1, remaining: 0, snapshotsDeleted: 4 }));

  const response = await __test.handleDeleteRecord(deleteRequest(), { DB }, USER, "req-last");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "RELOAD_UI");
});

test("non-last record delete preserves normal deleted response", async () => {
  const DB = makeAtomicDeleteDb(successBatch({ deleted: 1, remaining: 2 }));

  const response = await __test.handleDeleteRecord(deleteRequest(), { DB }, USER, "req-non-last");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, deleted: 1 });
});

test("atomic batch failure fails closed as a database error", async () => {
  const DB = makeAtomicDeleteDb(new Error("InjectedBatchFailure"));

  const response = await __test.handleDeleteRecord(deleteRequest(), { DB }, USER, "req-failure");
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error_meta.code, "DATABASE_ERROR");
  assert.equal(DB.batched.length, 1);
});

test("malformed atomic batch result fails closed", async () => {
  const DB = makeAtomicDeleteDb([{ meta: { changes: 0 } }]);

  const response = await __test.handleDeleteRecord(deleteRequest(), { DB }, USER, "req-malformed");
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error_meta.code, "DATABASE_ERROR");
});

test("impossible multi-row delete cardinality fails closed", async () => {
  const DB = makeAtomicDeleteDb(successBatch({ deleted: 2, remaining: 0, snapshotsDeleted: 4 }));

  const response = await __test.handleDeleteRecord(deleteRequest(), { DB }, USER, "req-cardinality");
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error_meta.code, "DATABASE_ERROR");
});
