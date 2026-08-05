import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "../worker.js";

const { parseRecordPageRequest, encodeRecordCursor, decodeRecordCursor, recordsRepository } = __test;

test("record page request validates bounds and opaque cursor", () => {
  const row = { id: 42, txn_date: "2026-08-05", created_at: "2026-08-05 10:00:00" };
  const cursor = encodeRecordCursor(row);
  const parsed = parseRecordPageRequest(new URL(`https://example.test/api/records?limit=50&cursor=${cursor}`));
  assert.equal(parsed.limit, 50);
  assert.deepEqual(parsed.cursor, { v: 1, d: row.txn_date, c: row.created_at, i: row.id });
  assert.deepEqual(decodeRecordCursor(cursor), parsed.cursor);
  assert.throws(() => parseRecordPageRequest(new URL("https://example.test/api/records?limit=0")), /between 1 and 1000/);
  assert.throws(() => parseRecordPageRequest(new URL("https://example.test/api/records?cursor=bad")), /cursor/);
});

test("records repository uses deterministic user-scoped keyset ordering", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return { async all() { return { results: [
            { id: 3, user_id: "a@example.com", txn_date: "2026-08-05", created_at: "2026-08-05 10:00:00" },
            { id: 2, user_id: "a@example.com", txn_date: "2026-08-05", created_at: "2026-08-05 10:00:00" },
          ] }; } };
        },
      };
    },
  };
  const page = await recordsRepository.listPage(db, { kind: "single-user", userId: "a@example.com" }, { limit: 1, cursor: null });
  assert.equal(page.items.length, 1);
  assert.equal(page.hasMore, true);
  assert.ok(page.nextCursor);
  assert.match(calls[0].sql, /user_id = \?/);
  assert.match(calls[0].sql, /txn_date DESC, created_at DESC, id DESC/);
  assert.deepEqual(calls[0].values, ["a@example.com", 2]);
});

test("cursor pagination keeps id as final tie breaker", async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return { bind(...values) { calls.push({ sql, values }); return { async all() { return { results: [] }; } }; } };
    },
  };
  const cursor = { v: 1, d: "2026-08-05", c: "2026-08-05 10:00:00", i: 2 };
  await recordsRepository.listPage(db, { kind: "all-users" }, { limit: 100, cursor });
  assert.match(calls[0].sql, /id < \?/);
  assert.match(calls[0].sql, /id DESC/);
  assert.deepEqual(calls[0].values, [cursor.d, cursor.d, cursor.c, cursor.d, cursor.c, cursor.i, 101]);
});
