from pathlib import Path

worker = Path('worker.js')
text = worker.read_text(encoding='utf-8')
text = text.replace(' * v2.58 / PR-05D: restore repository-owned GitHub workflow dispatch,\n * classify upstream failures, and preserve reproducible deployment metadata.\n', ' * v2.59 / PR-06: deterministic cursor pagination and records data-access layer.\n')
text = text.replace('const RELEASE_VERSION = "4.05.1";\nconst API_VERSION = "2.58";\n', 'const RELEASE_VERSION = "4.06";\nconst API_VERSION = "2.59";\n')
text = text.replace('const TRIGGER_COOLDOWN_SECONDS = 60;\n', 'const TRIGGER_COOLDOWN_SECONDS = 60;\nconst RECORD_PAGE_DEFAULT_LIMIT = 250;\nconst RECORD_PAGE_MAX_LIMIT = 1_000;\nconst RECORD_CURSOR_VERSION = 1;\n')
old = '''async function handleGetRecords(request, env, principal, requestId) {
  try {
    const scope = resolveRecordScope(principal, request.headers.get("X-Target-User"));
    let statement;
    if (scope.kind === "single-user") {
      statement = env.DB.prepare(
        "SELECT * FROM records WHERE user_id = ? ORDER BY txn_date DESC, created_at DESC LIMIT 1000",
      ).bind(scope.userId);
    } else {
      statement = env.DB.prepare(
        "SELECT * FROM records ORDER BY txn_date DESC, created_at DESC LIMIT 1000",
      );
    }

    const result = await statement.all();
    return jsonResponse({ success: true, data: Array.isArray(result.results) ? result.results : [] });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("INVALID_TARGET_USER", error.message, 400, requestId);
    }
    console.error(`[request_id=${requestId}] Records read failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "Records are unavailable", 500, requestId);
  }
}
'''
new = '''async function handleGetRecords(request, env, principal, requestId) {
  try {
    const scope = resolveRecordScope(principal, request.headers.get("X-Target-User"));
    const pagination = parseRecordPageRequest(new URL(request.url));
    const page = await recordsRepository.listPage(env.DB, scope, pagination);
    return jsonResponse({
      success: true,
      data: page.items,
      page: {
        limit: pagination.limit,
        count: page.items.length,
        has_more: page.hasMore,
        next_cursor: page.nextCursor,
      },
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("INVALID_REQUEST", error.message, 400, requestId);
    }
    console.error(`[request_id=${requestId}] Records read failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "Records are unavailable", 500, requestId);
  }
}
'''
if old not in text:
    raise SystemExit('handleGetRecords block not found')
text = text.replace(old, new)
text = text.replace('''    await env.DB.prepare(
      "INSERT INTO records (user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      principal.email,
      body.txn_date,
      body.symbol,
      body.txn_type,
      body.qty,
      body.price,
      body.fee,
      body.tax,
      body.tag,
      body.note,
    ).run();
''', '''    await recordsRepository.insert(env.DB, principal.email, body);
''')
text = text.replace('''    const result = await env.DB.prepare(
      "UPDATE records SET txn_date=?, symbol=?, txn_type=?, qty=?, price=?, fee=?, tax=?, tag=?, note=? WHERE id=? AND user_id=?",
    ).bind(
      body.txn_date,
      body.symbol,
      body.txn_type,
      body.qty,
      body.price,
      body.fee,
      body.tax,
      body.tag,
      body.note,
      body.id,
      principal.email,
    ).run();

    if (affectedRows(result) !== 1) {
''', '''    const changed = await recordsRepository.update(env.DB, principal.email, body);

    if (changed !== 1) {
''')
text = text.replace('''    const result = await env.DB.prepare(
      "DELETE FROM records WHERE id = ? AND user_id = ?",
    ).bind(id, principal.email).run();

    if (affectedRows(result) !== 1) {
''', '''    const changed = await recordsRepository.delete(env.DB, principal.email, id);

    if (changed !== 1) {
''')
text = text.replace('''    const check = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM records WHERE user_id = ?",
    ).bind(principal.email).first();

    if (!check || Number(check.total) === 0) {
''', '''    const remaining = await recordsRepository.countForUser(env.DB, principal.email);

    if (remaining === 0) {
''')
insert_before = 'async function handleAddRecord(request, env, principal, requestId) {'
repo_code = r'''function parseRecordPageRequest(url) {
  const rawLimit = url.searchParams.get("limit");
  let limit = RECORD_PAGE_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      throw new RequestValidationError("limit must be an integer");
    }
    limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > RECORD_PAGE_MAX_LIMIT) {
      throw new RequestValidationError(`limit must be between 1 and ${RECORD_PAGE_MAX_LIMIT}`);
    }
  }
  const rawCursor = url.searchParams.get("cursor");
  return { limit, cursor: rawCursor ? decodeRecordCursor(rawCursor) : null };
}

function encodeRecordCursor(row) {
  const payload = {
    v: RECORD_CURSOR_VERSION,
    d: String(row.txn_date || ""),
    c: String(row.created_at || ""),
    i: Number(row.id),
  };
  validateRecordCursorPayload(payload);
  return base64UrlEncode(JSON.stringify(payload));
}

function decodeRecordCursor(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new RequestValidationError("cursor is invalid");
  }
  try {
    const payload = JSON.parse(base64UrlDecode(value));
    validateRecordCursorPayload(payload);
    return payload;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError("cursor is invalid");
  }
}

function validateRecordCursorPayload(payload) {
  if (!isPlainObject(payload) || payload.v !== RECORD_CURSOR_VERSION) {
    throw new RequestValidationError("cursor version is invalid");
  }
  if (typeof payload.d !== "string" || !DATE_RE.test(payload.d)) {
    throw new RequestValidationError("cursor date is invalid");
  }
  if (typeof payload.c !== "string" || payload.c.length < 1 || payload.c.length > 64) {
    throw new RequestValidationError("cursor timestamp is invalid");
  }
  if (!Number.isSafeInteger(payload.i) || payload.i <= 0) {
    throw new RequestValidationError("cursor id is invalid");
  }
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const recordsRepository = Object.freeze({
  async listPage(db, scope, pagination) {
    const { limit, cursor } = pagination;
    const fetchLimit = limit + 1;
    let statement;
    if (scope.kind === "single-user" && cursor) {
      statement = db.prepare(
        "SELECT * FROM records WHERE user_id = ? AND (txn_date < ? OR (txn_date = ? AND created_at < ?) OR (txn_date = ? AND created_at = ? AND id < ?)) ORDER BY txn_date DESC, created_at DESC, id DESC LIMIT ?",
      ).bind(scope.userId, cursor.d, cursor.d, cursor.c, cursor.d, cursor.c, cursor.i, fetchLimit);
    } else if (scope.kind === "single-user") {
      statement = db.prepare(
        "SELECT * FROM records WHERE user_id = ? ORDER BY txn_date DESC, created_at DESC, id DESC LIMIT ?",
      ).bind(scope.userId, fetchLimit);
    } else if (cursor) {
      statement = db.prepare(
        "SELECT * FROM records WHERE (txn_date < ? OR (txn_date = ? AND created_at < ?) OR (txn_date = ? AND created_at = ? AND id < ?)) ORDER BY txn_date DESC, created_at DESC, id DESC LIMIT ?",
      ).bind(cursor.d, cursor.d, cursor.c, cursor.d, cursor.c, cursor.i, fetchLimit);
    } else {
      statement = db.prepare(
        "SELECT * FROM records ORDER BY txn_date DESC, created_at DESC, id DESC LIMIT ?",
      ).bind(fetchLimit);
    }
    const result = await statement.all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && items.length ? encodeRecordCursor(items[items.length - 1]) : null;
    return { items, hasMore, nextCursor };
  },

  async insert(db, userId, body) {
    return db.prepare(
      "INSERT INTO records (user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(userId, body.txn_date, body.symbol, body.txn_type, body.qty, body.price, body.fee, body.tax, body.tag, body.note).run();
  },

  async update(db, userId, body) {
    const result = await db.prepare(
      "UPDATE records SET txn_date=?, symbol=?, txn_type=?, qty=?, price=?, fee=?, tax=?, tag=?, note=? WHERE id=? AND user_id=?",
    ).bind(body.txn_date, body.symbol, body.txn_type, body.qty, body.price, body.fee, body.tax, body.tag, body.note, body.id, userId).run();
    return affectedRows(result);
  },

  async delete(db, userId, id) {
    const result = await db.prepare("DELETE FROM records WHERE id = ? AND user_id = ?").bind(id, userId).run();
    return affectedRows(result);
  },

  async countForUser(db, userId) {
    const result = await db.prepare("SELECT COUNT(*) as total FROM records WHERE user_id = ?").bind(userId).first();
    const count = Number(result?.total);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("InvalidRecordCount");
    return count;
  },
});

'''
if insert_before not in text:
    raise SystemExit('insert location not found')
text = text.replace(insert_before, repo_code + insert_before)
text = text.replace('''  resolveRecordScope,
  resolveSettingsTarget,
''', '''  resolveRecordScope,
  resolveSettingsTarget,
  parseRecordPageRequest,
  encodeRecordCursor,
  decodeRecordCursor,
  recordsRepository,
''')
worker.write_text(text, encoding='utf-8')

client = Path('journal_engine/clients/api_client.py')
ct = client.read_text(encoding='utf-8')
ct = ct.replace('REQUEST_TIMEOUT: Tuple[float, float] = (5.0, 30.0)\n', 'REQUEST_TIMEOUT: Tuple[float, float] = (5.0, 30.0)\nRECORD_PAGE_LIMIT = 1_000\nMAX_RECORD_PAGES = 2_000\nMAX_RECORD_COUNT = 1_000_000\n')
old_client = '''    def fetch_records(self, target_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch transaction records and reject unverifiable API responses."""
        self.logger.info("正在連線至交易紀錄 API")
        try:
            response = requests.get(
                WORKER_API_URL_RECORDS,
                headers=self._headers(target_user_id),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise CloudflareAPIError("交易紀錄 API 連線失敗") from exc

        if response.status_code != 200:
            raise CloudflareAPIError(
                f"交易紀錄 API 回應失敗 [status={response.status_code}]"
            )

        payload = self._decode_json(response, "交易紀錄 API")
        if payload.get("success") is not True:
            raise CloudflareAPIError("交易紀錄 API 未回傳 success=true")

        records = payload.get("data")
        if not isinstance(records, list):
            raise CloudflareAPIError("交易紀錄 API 的 data 欄位不是陣列")

        self.logger.info("成功取得 %s 筆交易紀錄", len(records))
        return records
'''
new_client = '''    def fetch_records(self, target_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch every records page and fail closed on inconsistent pagination."""
        self.logger.info("正在連線至交易紀錄 API")
        records: List[Dict[str, Any]] = []
        cursor: Optional[str] = None
        seen_cursors = set()

        for page_number in range(1, MAX_RECORD_PAGES + 1):
            params: Dict[str, Any] = {"limit": RECORD_PAGE_LIMIT}
            if cursor:
                params["cursor"] = cursor
            try:
                response = requests.get(
                    WORKER_API_URL_RECORDS,
                    headers=self._headers(target_user_id),
                    params=params,
                    timeout=REQUEST_TIMEOUT,
                )
            except requests.RequestException as exc:
                raise CloudflareAPIError("交易紀錄 API 連線失敗") from exc

            if response.status_code != 200:
                raise CloudflareAPIError(
                    f"交易紀錄 API 回應失敗 [status={response.status_code}]"
                )

            payload = self._decode_json(response, "交易紀錄 API")
            if payload.get("success") is not True:
                raise CloudflareAPIError("交易紀錄 API 未回傳 success=true")

            page_records = payload.get("data")
            page = payload.get("page")
            if not isinstance(page_records, list):
                raise CloudflareAPIError("交易紀錄 API 的 data 欄位不是陣列")
            if not isinstance(page, dict):
                raise CloudflareAPIError("交易紀錄 API 缺少分頁資訊")

            count = page.get("count")
            limit = page.get("limit")
            has_more = page.get("has_more")
            next_cursor = page.get("next_cursor")
            if not isinstance(count, int) or count != len(page_records):
                raise CloudflareAPIError("交易紀錄 API 分頁筆數不一致")
            if not isinstance(limit, int) or limit < 1 or limit > RECORD_PAGE_LIMIT:
                raise CloudflareAPIError("交易紀錄 API 分頁上限無效")
            if not isinstance(has_more, bool):
                raise CloudflareAPIError("交易紀錄 API has_more 無效")
            if has_more:
                if not isinstance(next_cursor, str) or not next_cursor:
                    raise CloudflareAPIError("交易紀錄 API 缺少 next_cursor")
                if next_cursor in seen_cursors:
                    raise CloudflareAPIError("交易紀錄 API 發生 cursor 循環")
                seen_cursors.add(next_cursor)
            elif next_cursor is not None:
                raise CloudflareAPIError("交易紀錄 API 結束頁仍回傳 cursor")

            records.extend(page_records)
            if len(records) > MAX_RECORD_COUNT:
                raise CloudflareAPIError("交易紀錄 API 回傳筆數超過安全上限")
            self.logger.info(
                "交易紀錄 API 第 %s 頁完成：本頁 %s 筆，累計 %s 筆",
                page_number,
                len(page_records),
                len(records),
            )
            if not has_more:
                self.logger.info("成功取得 %s 筆交易紀錄", len(records))
                return records
            cursor = next_cursor

        raise CloudflareAPIError("交易紀錄 API 分頁數超過安全上限")
'''
if old_client not in ct:
    raise SystemExit('client method not found')
ct = ct.replace(old_client, new_client)
client.write_text(ct, encoding='utf-8')

Path('tests/worker_records_pagination.test.mjs').write_text(r'''import test from "node:test";
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
''', encoding='utf-8')

Path('tests/test_api_client_pagination.py').write_text(r'''from unittest.mock import Mock

import pytest

from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient


def response(payload, status=200):
    item = Mock()
    item.status_code = status
    item.json.return_value = payload
    return item


def test_fetch_records_consumes_all_pages(monkeypatch):
    pages = [
        response({"success": True, "data": [{"id": 3}, {"id": 2}], "page": {"limit": 1000, "count": 2, "has_more": True, "next_cursor": "next-one"}}),
        response({"success": True, "data": [{"id": 1}], "page": {"limit": 1000, "count": 1, "has_more": False, "next_cursor": None}}),
    ]
    get = Mock(side_effect=pages)
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", get)
    assert CloudflareClient().fetch_records("user@example.com") == [{"id": 3}, {"id": 2}, {"id": 1}]
    assert get.call_args_list[0].kwargs["params"] == {"limit": 1000}
    assert get.call_args_list[1].kwargs["params"] == {"limit": 1000, "cursor": "next-one"}


def test_fetch_records_rejects_cursor_cycle(monkeypatch):
    pages = [
        response({"success": True, "data": [{"id": 2}], "page": {"limit": 1000, "count": 1, "has_more": True, "next_cursor": "same"}}),
        response({"success": True, "data": [{"id": 1}], "page": {"limit": 1000, "count": 1, "has_more": True, "next_cursor": "same"}}),
    ]
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(side_effect=pages))
    with pytest.raises(CloudflareAPIError, match="cursor"):
        CloudflareClient().fetch_records()


@pytest.mark.parametrize("page", [None, {}, {"limit": 1000, "count": 2, "has_more": False, "next_cursor": None}])
def test_fetch_records_rejects_malformed_page(monkeypatch, page):
    payload = {"success": True, "data": [{"id": 1}], "page": page}
    monkeypatch.setattr("journal_engine.clients.api_client.requests.get", Mock(return_value=response(payload)))
    with pytest.raises(CloudflareAPIError):
        CloudflareClient().fetch_records()
''', encoding='utf-8')
