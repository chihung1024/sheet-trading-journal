import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "../worker.js";

const { parseRecordPageRequest, encodeRecordCursor, decodeRecordCursor, recordsRepository } = __test;

test("record page request validates bounds and signed scope-bound cursor", async () => {
  const row = { id: 42, txn_date: "2026-08-05", created_at: "2026-08-05 10:00:00" };
  const secret = "cursor-test-secret-at-least-16";
  const scope = { kind: "single-user", userId: "a@example.com" };
  const cursor = await encodeRecordCursor(row, secret, scope);
  const parsed = await parseRecordPageRequest(new URL(`https://example.test/api/records?limit=50&cursor=${cursor}`), secret, scope);
  assert.equal(parsed.limit, 50);
  assert.deepEqual(parsed.cursor, { v: 1, d: row.txn_date, c: row.created_at, i: row.id });
  assert.deepEqual(await decodeRecordCursor(cursor, secret, scope), parsed.cursor);
  await assert.rejects(() => decodeRecordCursor(cursor, secret, { kind: "all-users" }), /signature/);
  const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("A") ? "B" : "A"}`;
  await assert.rejects(() => decodeRecordCursor(tampered, secret, scope), /signature/);
  await assert.rejects(() => parseRecordPageRequest(new URL("https://example.test/api/records?limit=0"), secret, scope), /between 1 and 1000/);
  await assert.rejects(() => parseRecordPageRequest(new URL("https://example.test/api/records?cursor=bad"), secret, scope), /cursor/);
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
  const page = await recordsRepository.listPage(db, { kind: "single-user", userId: "a@example.com" }, { limit: 1, cursor: null }, "cursor-test-secret-at-least-16");
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
  await recordsRepository.listPage(db, { kind: "all-users" }, { limit: 100, cursor }, "cursor-test-secret-at-least-16");
  assert.match(calls[0].sql, /id < \?/);
  assert.match(calls[0].sql, /id DESC/);
  assert.deepEqual(calls[0].values, [cursor.d, cursor.d, cursor.c, cursor.d, cursor.c, cursor.i, 101]);
});


test("record page defaults to the legacy 1000-row compatibility limit", async () => {
  const parsed = await parseRecordPageRequest(new URL("https://example.test/api/records"), "cursor-test-secret-at-least-16", { kind: "all-users" });
  assert.equal(parsed.limit, 1000);
});
