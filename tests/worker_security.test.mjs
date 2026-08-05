import test from "node:test";
import assert from "node:assert/strict";
import worker, { __test } from "../worker.js";

const USER = { kind: "user", email: "user@example.com" };
const SYSTEM = { kind: "system" };

function makeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, binds: [] };
      calls.push(call);
      return {
        bind(...args) {
          call.binds = args;
          return this;
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

test("permission matrix applies least privilege", () => {
  assert.equal(__test.authorize(USER, "GET /api/records"), true);
  assert.equal(__test.authorize(USER, "POST /api/portfolio"), false);
  assert.equal(__test.authorize(SYSTEM, "POST /api/portfolio"), true);
  assert.equal(__test.authorize(SYSTEM, "DELETE /api/records"), false);
  assert.equal(__test.authorize(SYSTEM, "POST /api/user-settings"), false);
});

test("system secret comparison is exact", () => {
  assert.equal(__test.constantTimeEqual("secret", "secret"), true);
  assert.equal(__test.constantTimeEqual("secret", "secreu"), false);
  assert.equal(__test.constantTimeEqual("secret", "secret-long"), false);
});

test("user scope ignores X-Target-User while system scope enforces it", () => {
  assert.deepEqual(
    __test.resolveRecordScope(USER, "other@example.com"),
    { kind: "single-user", userId: "user@example.com" },
  );
  assert.deepEqual(
    __test.resolveRecordScope(SYSTEM, "Other@Example.com"),
    { kind: "single-user", userId: "other@example.com" },
  );
  assert.deepEqual(__test.resolveRecordScope(SYSTEM, null), { kind: "all-users" });
  assert.equal(__test.resolveSettingsTarget(USER, "other@example.com"), "user@example.com");
  assert.throws(() => __test.resolveSettingsTarget(SYSTEM, null), /X-Target-User/);
});

test("Google claims require issuer, verified email, subject, audience, and expiry", () => {
  const now = 2_000_000_000;
  const header = { alg: "RS256", kid: "key-1" };
  const payload = {
    aud: "client-id",
    iss: "https://accounts.google.com",
    exp: now + 600,
    iat: now - 60,
    sub: "subject-1",
    email: "user@example.com",
    email_verified: true,
  };
  assert.doesNotThrow(() => __test.validateGoogleClaims(header, payload, "client-id", now));
  assert.throws(
    () => __test.validateGoogleClaims(header, { ...payload, iss: "https://evil.invalid" }, "client-id", now),
    /issuer/,
  );
  assert.throws(
    () => __test.validateGoogleClaims(header, { ...payload, email_verified: false }, "client-id", now),
    /verified/,
  );
  assert.throws(
    () => __test.validateGoogleClaims(header, { ...payload, exp: now - 100 }, "client-id", now),
    /Expired/,
  );
});

test("transaction validation rejects owner injection and unsafe values", () => {
  const valid = {
    txn_date: "2026-08-05",
    symbol: "brk-b",
    txn_type: "buy",
    qty: 2,
    price: 100,
    fee: 1,
    tax: 0,
    tag: "Core",
  };
  assert.deepEqual(__test.validateTransactionPayload(valid, { requireId: false }), {
    txn_date: "2026-08-05",
    symbol: "BRK-B",
    txn_type: "BUY",
    qty: 2,
    price: 100,
    fee: 1,
    tax: 0,
    tag: "Core",
    note: "",
  });
  assert.throws(
    () => __test.validateTransactionPayload({ ...valid, user_id: "other@example.com" }, { requireId: false }),
    /not accepted/,
  );
  assert.throws(
    () => __test.validateTransactionPayload({ ...valid, qty: Number.NaN }, { requireId: false }),
    /finite/,
  );
  assert.throws(
    () => __test.validateTransactionPayload({ ...valid, txn_type: "SHORT" }, { requireId: false }),
    /BUY, SELL, or DIV/,
  );
});

test("CORS allowlist reflects only approved browser origin", () => {
  const request = new Request("https://api.example.test/api/records", {
    headers: { Origin: "https://sheet-trading-journal.pages.dev" },
  });
  const response = __test.withCors(new Response("ok"), request, {});
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://sheet-trading-journal.pages.dev",
  );
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
  assert.equal(response.headers.get("Access-Control-Allow-Headers").includes("X-API-KEY"), false);
});

test("Cloudflare Pages branch previews are allowed without wildcard responses", () => {
  assert.equal(
    __test.isOriginAllowed("https://pr-03-security.sheet-trading-journal.pages.dev", {}),
    true,
  );
  assert.equal(
    __test.isOriginAllowed("https://sheet-trading-journal.pages.dev.evil.invalid", {}),
    false,
  );
});

test("CORS rejects unapproved origins and privileged browser headers", () => {
  const deniedOrigin = new Request("https://api.example.test/api/records", {
    method: "OPTIONS",
    headers: {
      Origin: "https://evil.invalid",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(__test.validateCorsRequest(deniedOrigin, {}, "req-1").status, 403);

  const privilegedHeader = new Request("https://api.example.test/api/records", {
    method: "OPTIONS",
    headers: {
      Origin: "https://sheet-trading-journal.pages.dev",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "X-API-KEY, X-Target-User",
    },
  });
  assert.equal(__test.validateCorsRequest(privilegedHeader, {}, "req-2").status, 403);
});

test("system target record request is filtered at the Worker database layer", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/records", {
    headers: {
      "X-API-KEY": "runner-secret",
      "X-Target-User": "Target@Example.com",
    },
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  assert.equal(response.status, 200);
  assert.match(DB.calls[0].sql, /WHERE user_id = \?/);
  assert.deepEqual(DB.calls[0].binds, ["target@example.com", 1001]);
});

test("system principal cannot mutate source transaction records", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/records", {
    method: "DELETE",
    headers: {
      "X-API-KEY": "runner-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: 1 }),
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error_meta.code, "FORBIDDEN");
  assert.equal(DB.calls.length, 0);
});

test("system snapshot upload requires a validated target and never trusts user routes", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/portfolio", {
    method: "POST",
    headers: {
      "X-API-KEY": "runner-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_user_id: "Target@Example.com",
      data: { updated_at: "2026-08-05T00:00:00Z", groups: { all: {} } },
    }),
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  assert.equal(response.status, 200);
  assert.deepEqual(DB.calls[0].binds.slice(0, 1), ["target@example.com"]);
});

test("system settings requests fail closed without an explicit target", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/user-settings", {
    headers: { "X-API-KEY": "runner-secret" },
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error_meta.code, "INVALID_REQUEST");
  assert.equal(DB.calls.length, 0);
});

test("scheduled system record reads retain explicit all-user compatibility", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/records", {
    headers: { "X-API-KEY": "runner-secret" },
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  assert.equal(response.status, 200);
  assert.doesNotMatch(DB.calls[0].sql, /WHERE user_id/);
  assert.deepEqual(DB.calls[0].binds, [1001]);
});

test("malformed JSON is rejected before any snapshot write", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/portfolio", {
    method: "POST",
    headers: {
      "X-API-KEY": "runner-secret",
      "Content-Type": "application/json",
    },
    body: "{",
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error_meta.code, "INVALID_REQUEST");
  assert.equal(DB.calls.length, 0);
});

test("oversized JSON is rejected before any snapshot write", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/portfolio", {
    method: "POST",
    headers: {
      "X-API-KEY": "runner-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_user_id: "target@example.com",
      data: { payload: "x".repeat(1_048_576) },
    }),
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error_meta.code, "INVALID_REQUEST");
  assert.equal(DB.calls.length, 0);
});

test("unauthenticated portfolio reads are rejected", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/portfolio");
  const response = await worker.fetch(request, { DB }, {});
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error_meta.code, "UNAUTHORIZED");
  assert.equal(DB.calls.length, 0);
});

test("invalid system credentials fail closed", async () => {
  const DB = makeDb();
  const request = new Request("https://api.example.test/api/records", {
    headers: { "X-API-KEY": "wrong-secret" },
  });
  const response = await worker.fetch(request, { API_SECRET: "runner-secret", DB }, {});
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error_meta.code, "UNAUTHORIZED");
  assert.equal(DB.calls.length, 0);
});
