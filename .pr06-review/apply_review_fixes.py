from pathlib import Path

path = Path('worker.js')
text = path.read_text(encoding='utf-8')
text = text.replace('const RECORD_PAGE_DEFAULT_LIMIT = 250;', 'const RECORD_PAGE_DEFAULT_LIMIT = 1_000;')
text = text.replace(
    'const pagination = parseRecordPageRequest(new URL(request.url));\n    const page = await recordsRepository.listPage(env.DB, scope, pagination);',
    'const pagination = await parseRecordPageRequest(new URL(request.url), env.API_SECRET, scope);\n    const page = await recordsRepository.listPage(env.DB, scope, pagination, env.API_SECRET);',
)
text = text.replace('function parseRecordPageRequest(url) {', 'async function parseRecordPageRequest(url, signingSecret, scope) {')
text = text.replace(
    'return { limit, cursor: rawCursor ? decodeRecordCursor(rawCursor) : null };',
    'return { limit, cursor: rawCursor ? await decodeRecordCursor(rawCursor, signingSecret, scope) : null };',
)
start = text.index('function encodeRecordCursor(row) {')
end = text.index('\nconst recordsRepository = Object.freeze({', start)
replacement = r'''async function encodeRecordCursor(row, signingSecret, scope) {
  const payload = {
    v: RECORD_CURSOR_VERSION,
    d: String(row.txn_date || ""),
    c: String(row.created_at || ""),
    i: Number(row.id),
  };
  validateRecordCursorPayload(payload);
  const encoded = recordCursorBase64Encode(JSON.stringify(payload));
  const signature = await signRecordCursor(encoded, signingSecret, scope);
  return `${encoded}.${signature}`;
}

async function decodeRecordCursor(value, signingSecret, scope) {
  if (typeof value !== "string" || value.length < 24 || value.length > 768) {
    throw new RequestValidationError("cursor is invalid");
  }
  const parts = value.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    throw new RequestValidationError("cursor is invalid");
  }
  try {
    const [encoded, providedSignature] = parts;
    const expectedSignature = await signRecordCursor(encoded, signingSecret, scope);
    if (!constantTimeEqual(providedSignature, expectedSignature)) {
      throw new RequestValidationError("cursor signature is invalid");
    }
    const payload = JSON.parse(recordCursorBase64Decode(encoded));
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

function recordCursorScope(scope) {
  if (scope?.kind === "single-user") return `single-user:${scope.userId}`;
  if (scope?.kind === "all-users") return "all-users";
  throw new RequestValidationError("record scope is invalid");
}

async function signRecordCursor(encodedPayload, signingSecret, scope) {
  if (typeof signingSecret !== "string" || signingSecret.length < 16) {
    throw new Error("CursorSigningSecretUnavailable");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = `${recordCursorScope(scope)}\n${encodedPayload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return recordCursorBase64EncodeBytes(signature.slice(0, 16));
}

function recordCursorBase64Encode(value) {
  return recordCursorBase64EncodeBytes(new TextEncoder().encode(value));
}

function recordCursorBase64EncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function recordCursorBase64Decode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
'''
text = text[:start] + replacement + text[end:]
text = text.replace('async listPage(db, scope, pagination) {', 'async listPage(db, scope, pagination, signingSecret) {')
text = text.replace(
    'const nextCursor = hasMore && items.length ? encodeRecordCursor(items[items.length - 1]) : null;',
    'const nextCursor = hasMore && items.length\n      ? await encodeRecordCursor(items[items.length - 1], signingSecret, scope)\n      : null;',
)
path.write_text(text, encoding='utf-8')

path = Path('tests/worker_records_pagination.test.mjs')
t = path.read_text(encoding='utf-8')
t = t.replace('test("record page request validates bounds and opaque cursor", () => {', 'test("record page request validates bounds and signed scope-bound cursor", async () => {')
t = t.replace('const cursor = encodeRecordCursor(row);', 'const secret = "cursor-test-secret-at-least-16";\n  const scope = { kind: "single-user", userId: "a@example.com" };\n  const cursor = await encodeRecordCursor(row, secret, scope);')
t = t.replace('const parsed = parseRecordPageRequest(new URL(`https://example.test/api/records?limit=50&cursor=${cursor}`));', 'const parsed = await parseRecordPageRequest(new URL(`https://example.test/api/records?limit=50&cursor=${cursor}`), secret, scope);')
t = t.replace('assert.deepEqual(decodeRecordCursor(cursor), parsed.cursor);', 'assert.deepEqual(await decodeRecordCursor(cursor, secret, scope), parsed.cursor);\n  await assert.rejects(() => decodeRecordCursor(cursor, secret, { kind: "all-users" }), /signature/);\n  const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("A") ? "B" : "A"}`;\n  await assert.rejects(() => decodeRecordCursor(tampered, secret, scope), /signature/);')
t = t.replace('assert.throws(() => parseRecordPageRequest(new URL("https://example.test/api/records?limit=0")), /between 1 and 1000/);', 'await assert.rejects(() => parseRecordPageRequest(new URL("https://example.test/api/records?limit=0"), secret, scope), /between 1 and 1000/);')
t = t.replace('assert.throws(() => parseRecordPageRequest(new URL("https://example.test/api/records?cursor=bad")), /cursor/);', 'await assert.rejects(() => parseRecordPageRequest(new URL("https://example.test/api/records?cursor=bad"), secret, scope), /cursor/);')
t = t.replace('}, { limit: 1, cursor: null });', '}, { limit: 1, cursor: null }, "cursor-test-secret-at-least-16");')
t = t.replace('}, { limit: 100, cursor });', '}, { limit: 100, cursor }, "cursor-test-secret-at-least-16");')
t += '''\n\ntest("record page defaults to the legacy 1000-row compatibility limit", async () => {\n  const parsed = await parseRecordPageRequest(new URL("https://example.test/api/records"), "cursor-test-secret-at-least-16", { kind: "all-users" });\n  assert.equal(parsed.limit, 1000);\n});\n'''
path.write_text(t, encoding='utf-8')

path = Path('tests/worker_security.test.mjs')
t = path.read_text(encoding='utf-8')
t = t.replace('assert.deepEqual(DB.calls[0].binds, ["target@example.com", 251]);', 'assert.deepEqual(DB.calls[0].binds, ["target@example.com", 1001]);')
t = t.replace('assert.deepEqual(DB.calls[0].binds, [251]);', 'assert.deepEqual(DB.calls[0].binds, [1001]);')
path.write_text(t, encoding='utf-8')
