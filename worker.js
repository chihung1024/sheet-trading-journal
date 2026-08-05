/**
 * Worker: Trading Journal API
 * v2.60 / PR-07: durable calculation jobs, idempotent triggers, and observable status.
 */

const SERVICE_NAME = "trading-journal-api";
const RELEASE_VERSION = "4.07";
const API_VERSION = "2.60";
const GITHUB_DISPATCH = Object.freeze({
  owner: "chihung1024",
  repository: "sheet-trading-journal",
  workflow: "update.yml",
  ref: "main",
});
const GITHUB_DISPATCH_TIMEOUT_MS = 5_000;
const REQUIRED_SCHEMA_VERSION = 2;
const SOURCE_COMMIT_FALLBACK = "development";
const CORE_DATA_TABLES = ["records", "portfolio_snapshots", "user_settings", "calculation_jobs"];
const PUBLIC_ROUTE_METHODS = Object.freeze({
  "/api/health": new Set(["GET"]),
  "/api/version": new Set(["GET"]),
});

const DEFAULT_GOOGLE_CLIENT_ID =
  "951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://sheet-trading-journal.pages.dev",
  "https://chihung1024.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const CORS_HEADERS = ["Content-Type", "Authorization", "Idempotency-Key"];
const MAX_JSON_BYTES = 1_048_576;
const MAX_TOKEN_LENGTH = 8_192;
const TRIGGER_COOLDOWN_SECONDS = 60;
const RECORD_PAGE_DEFAULT_LIMIT = 1_000;
const RECORD_PAGE_MAX_LIMIT = 1_000;
const RECORD_CURSOR_VERSION = 1;
const CALCULATION_JOB_WINDOW_SECONDS = 15 * 60;
const CALCULATION_JOB_ID_RE = /^job_[A-Za-z0-9_-]{22}$/;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const CALCULATION_JOB_ERROR_RE = /^[A-Z0-9_]{1,64}$/;
const CALCULATION_JOB_TERMINAL_STATUSES = new Set(["succeeded", "failed"]);
const CALCULATION_JOB_STATUSES = new Set(["queued", "running", "succeeded", "failed"]);
const GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);
const TXN_TYPES = new Set(["BUY", "SELL", "DIV"]);
const SYMBOL_RE = /^[A-Z0-9.^=\-]{1,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_OWNER_FIELDS = new Set([
  "user_id",
  "target_user_id",
  "email",
  "owner",
  "owner_id",
  "role",
]);

const ROUTE_PERMISSIONS = Object.freeze({
  "POST /api/trigger-update": new Set(["user"]),
  "GET /api/calculation-jobs/:id": new Set(["user"]),
  "POST /api/calculation-jobs/status": new Set(["system"]),
  "GET /api/portfolio": new Set(["user"]),
  "POST /api/portfolio": new Set(["system"]),
  "GET /api/records": new Set(["user", "system"]),
  "POST /api/records": new Set(["user"]),
  "PUT /api/records": new Set(["user"]),
  "DELETE /api/records": new Set(["user"]),
  "GET /api/user-settings": new Set(["user", "system"]),
  "POST /api/user-settings": new Set(["user"]),
});

export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();

    try {
      const corsFailure = validateCorsRequest(request, env, requestId);
      if (corsFailure) return corsFailure;

      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }), request, env);
      }

      const url = new URL(request.url);

      if (url.pathname === "/auth/google") {
        if (request.method !== "POST") {
          return withCors(methodNotAllowed(requestId), request, env);
        }
        return withCors(await handleAuth(request, env, requestId), request, env);
      }

      const publicMethods = PUBLIC_ROUTE_METHODS[url.pathname];
      if (publicMethods) {
        if (!publicMethods.has(request.method)) {
          return withCors(methodNotAllowed(requestId), request, env);
        }
        const response = url.pathname === "/api/health"
          ? await handleHealth(env, requestId)
          : handleVersion(env, requestId);
        return withCors(response, request, env);
      }

      const calculationJobMatch = request.method === "GET"
        ? url.pathname.match(/^\/api\/calculation-jobs\/(job_[A-Za-z0-9_-]{22})$/)
        : null;
      const routeKey = calculationJobMatch
        ? "GET /api/calculation-jobs/:id"
        : `${request.method} ${url.pathname}`;
      if (!ROUTE_PERMISSIONS[routeKey]) {
        return withCors(apiError("NOT_FOUND", "Route not found", 404, requestId), request, env);
      }

      const principal = await authenticate(request, env);
      if (!principal) {
        return withCors(apiError("UNAUTHORIZED", "Unauthorized", 401, requestId), request, env);
      }
      if (!authorize(principal, routeKey)) {
        return withCors(apiError("FORBIDDEN", "Forbidden", 403, requestId), request, env);
      }

      let response;
      switch (routeKey) {
        case "POST /api/trigger-update":
          response = await handleGitHubTrigger(request, env, ctx, principal, requestId);
          break;
        case "GET /api/calculation-jobs/:id":
response = await handleGetCalculationJob(calculationJobMatch[1], env, principal, requestId);
break;
        case "POST /api/calculation-jobs/status":
response = await handleCalculationJobStatus(request, env, requestId);
break;
        case "GET /api/portfolio":
          response = await handleGetPortfolio(env, principal, requestId);
          break;
        case "POST /api/portfolio":
          response = await handleUploadPortfolio(request, env, principal, requestId);
          break;
        case "GET /api/records":
          response = await handleGetRecords(request, env, principal, requestId);
          break;
        case "POST /api/records":
          response = await handleAddRecord(request, env, principal, requestId);
          break;
        case "PUT /api/records":
          response = await handleUpdateRecord(request, env, principal, requestId);
          break;
        case "DELETE /api/records":
          response = await handleDeleteRecord(request, env, principal, requestId);
          break;
        case "GET /api/user-settings":
          response = await handleGetUserSettings(request, env, principal, requestId);
          break;
        case "POST /api/user-settings":
          response = await handleUpdateUserSettings(request, env, principal, requestId);
          break;
        default:
          response = apiError("NOT_FOUND", "Route not found", 404, requestId);
      }

      return withCors(response, request, env);
    } catch (error) {
      console.error(`[request_id=${requestId}] Unhandled Worker error`, safeErrorName(error));
      return withCors(
        apiError("INTERNAL_ERROR", "Internal server error", 500, requestId),
        request,
        env,
      );
    }
  },
};

function handleVersion(env, requestId) {
  const metadata = getBuildMetadata(env);
  return jsonResponse({
    success: true,
    status: "ok",
    request_id: requestId,
    ...metadata,
  });
}

async function handleHealth(env, requestId) {
  const metadata = getBuildMetadata(env);
  const checks = { database: "unavailable", schema: "unknown" };
  let schemaVersion = null;

  try {
    if (!env.DB || typeof env.DB.prepare !== "function") {
      throw new Error("D1BindingUnavailable");
    }

    const placeholders = CORE_DATA_TABLES.map(() => "?").join(", ");
    const tableResult = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
    ).bind(...CORE_DATA_TABLES).all();
    const tableNames = new Set(
      (Array.isArray(tableResult?.results) ? tableResult.results : [])
        .map((row) => String(row?.name || "")),
    );
    checks.database = CORE_DATA_TABLES.every((name) => tableNames.has(name))
      ? "ok"
      : "degraded";

    const schemaRow = await env.DB.prepare(
      "SELECT schema_version FROM schema_metadata WHERE id = 1",
    ).first();
    schemaVersion = Number(schemaRow?.schema_version);
    checks.schema = Number.isInteger(schemaVersion)
      && schemaVersion >= REQUIRED_SCHEMA_VERSION
      ? "ok"
      : "degraded";
  } catch (error) {
    console.warn(`[request_id=${requestId}] Health check degraded`, safeErrorName(error));
    checks.database = checks.database === "ok" ? "ok" : "unavailable";
    checks.schema = "unavailable";
  }

  const healthy = checks.database === "ok" && checks.schema === "ok";
  return jsonResponse(
    {
      success: healthy,
      status: healthy ? "ok" : "degraded",
      request_id: requestId,
      ...metadata,
      required_schema_version: REQUIRED_SCHEMA_VERSION,
      observed_schema_version: Number.isInteger(schemaVersion) ? schemaVersion : null,
      checks,
    },
    healthy ? 200 : 503,
  );
}

function getBuildMetadata(env = {}) {
  const runtime = isPlainObject(env.CF_VERSION_METADATA)
    ? {
        id: sanitizeMetadataValue(env.CF_VERSION_METADATA.id, 128),
        tag: sanitizeMetadataValue(env.CF_VERSION_METADATA.tag, 128),
        timestamp: sanitizeMetadataValue(env.CF_VERSION_METADATA.timestamp, 128),
      }
    : null;
  const workerVersion = runtime && (runtime.id || runtime.tag || runtime.timestamp)
    ? runtime
    : null;

  return {
    service: SERVICE_NAME,
    release_version: RELEASE_VERSION,
    api_version: API_VERSION,
    schema_version: REQUIRED_SCHEMA_VERSION,
    source_commit: normalizeSourceCommit(env.SOURCE_COMMIT),
    worker_version: workerVersion,
  };
}

function normalizeSourceCommit(value) {
  const normalized = sanitizeMetadataValue(value, 64);
  if (/^[0-9a-f]{7,40}$/i.test(normalized)) return normalized.toLowerCase();
  if (normalized === "development" || normalized === "unknown") return normalized;
  return SOURCE_COMMIT_FALLBACK;
}

function sanitizeMetadataValue(value, maxLength) {
  return String(value || "")
    .replace(/[\r\n]/g, "")
    .trim()
    .slice(0, maxLength);
}

function authorize(principal, routeKey) {
  return ROUTE_PERMISSIONS[routeKey]?.has(principal.kind) === true;
}

async function authenticate(request, env) {
  const apiKey = request.headers.get("X-API-KEY");
  if (apiKey !== null) {
    if (!env.API_SECRET || !constantTimeEqual(apiKey, env.API_SECRET)) return null;
    return { kind: "system" };
  }

  const authHeader = request.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const clientId = env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
    const payload = await verifyGoogleToken(match[1], clientId);
    return {
      kind: "user",
      email: normalizeEmail(payload.email),
      name: sanitizeText(payload.name || "", 200),
      sub: payload.sub,
    };
  } catch (error) {
    console.warn("Google token authentication rejected", safeErrorName(error));
    return null;
  }
}

async function handleAuth(request, env, requestId) {
  try {
    const body = await readJsonObject(request);
    const idToken = requireString(body.id_token, "id_token", 1, MAX_TOKEN_LENGTH);
    const clientId = env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
    const payload = await verifyGoogleToken(idToken, clientId);

    return jsonResponse({
      success: true,
      user: sanitizeText(payload.name || "", 200),
      email: normalizeEmail(payload.email),
      token: idToken,
    });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 401;
    const code = status === 400 ? "INVALID_REQUEST" : "INVALID_CREDENTIAL";
    return apiError(code, status === 400 ? error.message : "Authentication failed", status, requestId);
  }
}

async function handleGetPortfolio(env, principal, requestId) {
  try {
    const recordCheck = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM records WHERE user_id = ?",
    ).bind(principal.email).first();

    if (!recordCheck || Number(recordCheck.total) === 0) {
      return jsonResponse({ success: true, data: emptyPortfolio() });
    }

    const result = await env.DB.prepare(
      "SELECT json_data FROM portfolio_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    ).bind(principal.email).first();

    if (!result) return jsonResponse({ success: true, data: emptyPortfolio() });

    let parsed;
    try {
      parsed = JSON.parse(result.json_data);
    } catch {
      console.error(`[request_id=${requestId}] Stored portfolio JSON is invalid`);
      return apiError("DATA_INTEGRITY_ERROR", "Portfolio data is unavailable", 500, requestId);
    }
    return jsonResponse({ success: true, data: parsed });
  } catch (error) {
    console.error(`[request_id=${requestId}] Portfolio read failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "Portfolio data is unavailable", 500, requestId);
  }
}

async function handleUploadPortfolio(request, env, principal, requestId) {
  try {
    const payload = await readJsonObject(request);
    const targetUser = normalizeEmail(
      requireString(payload.target_user_id, "target_user_id", 3, 320),
    );
    if (!isPlainObject(payload.data)) {
      throw new RequestValidationError("data must be a JSON object");
    }

    const jsonString = JSON.stringify(payload.data);
    if (byteLength(jsonString) > MAX_JSON_BYTES) {
      throw new RequestValidationError("Portfolio payload is too large");
    }

    await env.DB.prepare(
      "INSERT INTO portfolio_snapshots (user_id, json_data) VALUES (?, ?)",
    ).bind(targetUser, jsonString).run();

    await env.DB.prepare(
      "DELETE FROM portfolio_snapshots WHERE user_id = ? AND id NOT IN (SELECT id FROM portfolio_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 10)",
    ).bind(targetUser, targetUser).run();

    console.info(`[request_id=${requestId}] System snapshot upload completed`);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("INVALID_REQUEST", error.message, 400, requestId);
    }
    console.error(`[request_id=${requestId}] Portfolio upload failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "Portfolio upload failed", 500, requestId);
  }
}

async function handleGetRecords(request, env, principal, requestId) {
  try {
    const scope = resolveRecordScope(principal, request.headers.get("X-Target-User"));
    const pagination = await parseRecordPageRequest(new URL(request.url), env.API_SECRET, scope);
    const page = await recordsRepository.listPage(env.DB, scope, pagination, env.API_SECRET);
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

async function parseRecordPageRequest(url, signingSecret, scope) {
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
  return { limit, cursor: rawCursor ? await decodeRecordCursor(rawCursor, signingSecret, scope) : null };
}

async function encodeRecordCursor(row, signingSecret, scope) {
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

const recordsRepository = Object.freeze({
  async listPage(db, scope, pagination, signingSecret) {
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
    const nextCursor = hasMore && items.length
      ? await encodeRecordCursor(items[items.length - 1], signingSecret, scope)
      : null;
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

async function handleAddRecord(request, env, principal, requestId) {
  try {
    const body = validateTransactionPayload(await readJsonObject(request), { requireId: false });
    await recordsRepository.insert(env.DB, principal.email, body);
    return jsonResponse({ success: true });
  } catch (error) {
    return mutationError(error, requestId, "Record creation failed");
  }
}

async function handleUpdateRecord(request, env, principal, requestId) {
  try {
    const body = validateTransactionPayload(await readJsonObject(request), { requireId: true });
    const changed = await recordsRepository.update(env.DB, principal.email, body);

    if (changed !== 1) {
      return apiError("NOT_FOUND", "Record not found", 404, requestId);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    return mutationError(error, requestId, "Record update failed");
  }
}

async function handleDeleteRecord(request, env, principal, requestId) {
  try {
    const body = await readJsonObject(request);
    rejectOwnerFields(body);
    const id = requirePositiveInteger(body.id, "id");

    const changed = await recordsRepository.delete(env.DB, principal.email, id);

    if (changed !== 1) {
      return apiError("NOT_FOUND", "Record not found", 404, requestId);
    }

    const remaining = await recordsRepository.countForUser(env.DB, principal.email);

    if (remaining === 0) {
      await env.DB.prepare(
        "DELETE FROM portfolio_snapshots WHERE user_id = ?",
      ).bind(principal.email).run();
      return jsonResponse({ success: true, message: "RELOAD_UI" });
    }

    return jsonResponse({ success: true, deleted: 1 });
  } catch (error) {
    return mutationError(error, requestId, "Record deletion failed");
  }
}

async function handleGetUserSettings(request, env, principal, requestId) {
  try {
    const targetUser = resolveSettingsTarget(principal, request.headers.get("X-Target-User"));
    const result = await env.DB.prepare(
      "SELECT benchmark FROM user_settings WHERE user_id = ?",
    ).bind(targetUser).first();
    const benchmark = result?.benchmark
      ? validateSymbol(result.benchmark, "stored benchmark")
      : "SPY";
    return jsonResponse({ success: true, benchmark });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("INVALID_REQUEST", error.message, 400, requestId);
    }
    console.error(`[request_id=${requestId}] User settings read failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "User settings are unavailable", 500, requestId);
  }
}

async function handleUpdateUserSettings(request, env, principal, requestId) {
  try {
    const body = await readJsonObject(request);
    rejectOwnerFields(body);
    const benchmark = validateSymbol(body.benchmark, "benchmark");

    await env.DB.prepare(`
      INSERT INTO user_settings (user_id, benchmark, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        benchmark = excluded.benchmark,
        updated_at = CURRENT_TIMESTAMP
    `).bind(principal.email, benchmark).run();

    return jsonResponse({ success: true, benchmark });
  } catch (error) {
    return mutationError(error, requestId, "User settings update failed");
  }
}

async function handleGitHubTrigger(request, env, ctx, principal, requestId) {
  try {
    if (!env.GITHUB_TOKEN) {
      console.error(`[request_id=${requestId}] GitHub dispatch token is unavailable`);
      return apiError("GITHUB_DISPATCH_NOT_CONFIGURED", "Update service is unavailable", 503, requestId);
    }

    const body = await readJsonObject(request, { allowEmpty: true });
    rejectOwnerFields(body);
    const benchmark = body.benchmark ? validateSymbol(body.benchmark, "benchmark") : "SPY";
    const idempotencyKey = resolveIdempotencyKey(request.headers.get("Idempotency-Key"));
    const idempotencyHash = await hashCalculationJobIdempotency(
      principal.email,
      idempotencyKey,
    );
    const created = await calculationJobsRepository.createOrGet(env.DB, {
      publicId: createCalculationJobId(),
      userId: principal.email,
      idempotencyHash,
      benchmark,
    });

    if (!created.inserted) {
      return jsonResponse({
        success: true,
        job: publicCalculationJob(created.job, true),
      });
    }

    const rateLimit = await claimTriggerSlot(principal.email, env, ctx);
    if (!rateLimit.allowed) {
      const failed = await calculationJobsRepository.transition(env.DB, {
        publicId: created.job.public_id,
        nextStatus: "failed",
        errorCode: "RATE_LIMITED",
      });
      const response = jsonResponse({
        success: false,
        error: "An update was triggered recently. Try again later.",
        error_meta: { code: "RATE_LIMITED", request_id: requestId },
        job: publicCalculationJob(failed.job || created.job, false),
      }, 429);
      response.headers.set("Retry-After", String(rateLimit.retryAfter));
      return response;
    }

    const result = await dispatchGitHubWorkflow({
      token: env.GITHUB_TOKEN,
      benchmark,
      userEmail: principal.email,
      jobId: created.job.public_id,
    });
    if (!result.ok) {
      await calculationJobsRepository.transition(env.DB, {
        publicId: created.job.public_id,
        nextStatus: "failed",
        errorCode: result.code,
      });
      console.error(
        `[request_id=${requestId}] GitHub dispatch failed ` +
        `[status=${result.status}] [code=${result.code}] ` +
        `[github_request_id=${result.githubRequestId || "unavailable"}]`,
      );
      const response = apiError(result.code, result.message, result.httpStatus, requestId);
      if (result.retryAfter) response.headers.set("Retry-After", result.retryAfter);
      return response;
    }

    console.info(
      `[request_id=${requestId}] GitHub dispatch accepted ` +
      `[job_id=${created.job.public_id}] ` +
      `[github_request_id=${result.githubRequestId || "unavailable"}]`,
    );
    return jsonResponse({
      success: true,
      job: publicCalculationJob(created.job, false),
    }, 202);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("INVALID_REQUEST", error.message, 400, requestId);
    }
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error(
      `[request_id=${requestId}] Trigger update failed ` +
      `[error=${isTimeout ? "timeout" : safeErrorName(error)}]`,
    );
    return apiError(
      isTimeout ? "GITHUB_DISPATCH_TIMEOUT" : "GITHUB_DISPATCH_FAILED",
      isTimeout ? "Update service timed out" : "Failed to trigger update",
      502,
      requestId,
    );
  }
}

async function handleGetCalculationJob(jobId, env, principal, requestId) {
  try {
    const normalizedJobId = validateCalculationJobId(jobId);
    const job = await calculationJobsRepository.findForUser(env.DB, normalizedJobId, principal.email);
    if (!job) return apiError("NOT_FOUND", "Calculation job not found", 404, requestId);
    return jsonResponse({ success: true, job: publicCalculationJob(job, false) });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("NOT_FOUND", "Calculation job not found", 404, requestId);
    }
    console.error(`[request_id=${requestId}] Calculation job read failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "Calculation job is unavailable", 500, requestId);
  }
}

async function handleCalculationJobStatus(request, env, requestId) {
  try {
    const body = await readJsonObject(request);
    const publicId = validateCalculationJobId(body.job_id);
    const nextStatus = requireString(body.status, "status", 6, 9).toLowerCase();
    if (!CALCULATION_JOB_STATUSES.has(nextStatus) || nextStatus === "queued") {
      throw new RequestValidationError("status transition is invalid");
    }
    const githubRunId = body.github_run_id === undefined || body.github_run_id === null
      ? null
      : requireString(String(body.github_run_id), "github_run_id", 1, 32);
    if (githubRunId !== null && !/^\d+$/.test(githubRunId)) {
      throw new RequestValidationError("github_run_id is invalid");
    }
    const githubRunAttempt = body.github_run_attempt === undefined
      ? 0
      : requireNonNegativeInteger(body.github_run_attempt, "github_run_attempt");
    const errorCode = nextStatus === "failed"
      ? validateCalculationJobErrorCode(body.error_code || "CALCULATION_FAILED")
      : null;

    const result = await calculationJobsRepository.transition(env.DB, {
      publicId,
      nextStatus,
      githubRunId,
      githubRunAttempt,
      errorCode,
    });
    if (result.kind === "not-found") {
      return apiError("NOT_FOUND", "Calculation job not found", 404, requestId);
    }
    if (result.kind === "invalid-transition" || result.kind === "conflict") {
      return apiError("INVALID_STATE_TRANSITION", "Calculation job transition rejected", 409, requestId);
    }
    return jsonResponse({ success: true, job: publicCalculationJob(result.job, false) });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return apiError("INVALID_REQUEST", error.message, 400, requestId);
    }
    console.error(`[request_id=${requestId}] Calculation job status update failed`, safeErrorName(error));
    return apiError("DATABASE_ERROR", "Calculation job status update failed", 500, requestId);
  }
}

function resolveIdempotencyKey(value) {
  if (value === null || String(value).trim() === "") {
    return `legacy.${crypto.randomUUID()}`;
  }
  return validateIdempotencyKey(value);
}

function validateIdempotencyKey(value) {
  const key = requireString(value, "Idempotency-Key", 16, 128);
  if (!IDEMPOTENCY_KEY_RE.test(key)) {
    throw new RequestValidationError("Idempotency-Key has an invalid format");
  }
  return key;
}

async function hashCalculationJobIdempotency(userId, key) {
  const normalizedUser = normalizeEmail(userId);
  const normalizedKey = validateIdempotencyKey(key);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${normalizedUser}\n${normalizedKey}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createCalculationJobId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `job_${recordCursorBase64EncodeBytes(bytes)}`;
}

function validateCalculationJobId(value) {
  const jobId = requireString(value, "job_id", 26, 26);
  if (!CALCULATION_JOB_ID_RE.test(jobId)) {
    throw new RequestValidationError("job_id is invalid");
  }
  return jobId;
}

function validateCalculationJobErrorCode(value) {
  const code = requireString(value, "error_code", 1, 64).toUpperCase();
  if (!CALCULATION_JOB_ERROR_RE.test(code)) {
    throw new RequestValidationError("error_code is invalid");
  }
  return code;
}

function canTransitionCalculationJob(currentStatus, nextStatus) {
  if (!CALCULATION_JOB_STATUSES.has(currentStatus) || !CALCULATION_JOB_STATUSES.has(nextStatus)) {
    return false;
  }
  if (currentStatus === nextStatus) return true;
  if (CALCULATION_JOB_TERMINAL_STATUSES.has(currentStatus)) return false;
  if (currentStatus === "queued") return nextStatus === "running" || nextStatus === "failed";
  if (currentStatus === "running") return nextStatus === "succeeded" || nextStatus === "failed";
  return false;
}

function publicCalculationJob(row, deduplicated) {
  return {
    id: row.public_id,
    status: row.status,
    benchmark: row.benchmark,
    attempt_count: Number(row.attempt_count || 0),
    created_at: row.created_at,
    started_at: row.started_at || null,
    completed_at: row.completed_at || null,
    error_code: row.error_code || null,
    deduplicated: Boolean(deduplicated),
  };
}

function normalizeCalculationJobRow(row) {
  if (!isPlainObject(row)) throw new Error("InvalidCalculationJobRow");
  if (!CALCULATION_JOB_STATUSES.has(row.status)) {
    throw new Error("InvalidCalculationJobStatus");
  }
  return {
    public_id: validateCalculationJobId(row.public_id),
    user_id: normalizeEmail(row.user_id),
    status: row.status,
    benchmark: validateSymbol(row.benchmark, "stored benchmark"),
    github_run_id: row.github_run_id || null,
    github_run_attempt: Number(row.github_run_attempt || 0),
    attempt_count: Number(row.attempt_count || 0),
    error_code: row.error_code || null,
    created_at: String(row.created_at || ""),
    started_at: row.started_at || null,
    completed_at: row.completed_at || null,
    updated_at: String(row.updated_at || ""),
  };
}

const calculationJobsRepository = Object.freeze({
  async createOrGet(db, job) {
    const userId = normalizeEmail(job.userId);
    const idempotencyHash = String(job.idempotencyHash || "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(idempotencyHash)) {
      throw new RequestValidationError("idempotency hash is invalid");
    }
    const benchmark = validateSymbol(job.benchmark, "benchmark");
    const expiryModifier = `-${CALCULATION_JOB_WINDOW_SECONDS} seconds`;

    await db.prepare(`
      UPDATE calculation_jobs
      SET idempotency_hash = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND idempotency_hash = ?
        AND created_at <= datetime('now', ?)
    `).bind(userId, idempotencyHash, expiryModifier).run();

    const insert = await db.prepare(`
      INSERT OR IGNORE INTO calculation_jobs
        (public_id, user_id, idempotency_hash, status, benchmark)
      VALUES (?, ?, ?, 'queued', ?)
    `).bind(
      validateCalculationJobId(job.publicId),
      userId,
      idempotencyHash,
      benchmark,
    ).run();
    const row = await db.prepare(`
      SELECT public_id, user_id, status, benchmark, github_run_id, github_run_attempt,
   attempt_count, error_code, created_at, started_at, completed_at, updated_at
      FROM calculation_jobs
      WHERE user_id = ? AND idempotency_hash = ?
      LIMIT 1
    `).bind(userId, idempotencyHash).first();
    if (!row) throw new Error("CalculationJobInsertLost");
    return { inserted: affectedRows(insert) === 1, job: normalizeCalculationJobRow(row) };
  },

  async findForUser(db, publicId, userId) {
    const row = await db.prepare(`
      SELECT public_id, user_id, status, benchmark, github_run_id, github_run_attempt,
   attempt_count, error_code, created_at, started_at, completed_at, updated_at
      FROM calculation_jobs
      WHERE public_id = ? AND user_id = ?
      LIMIT 1
    `).bind(validateCalculationJobId(publicId), normalizeEmail(userId)).first();
    return row ? normalizeCalculationJobRow(row) : null;
  },

  async findById(db, publicId) {
    const row = await db.prepare(`
      SELECT public_id, user_id, status, benchmark, github_run_id, github_run_attempt,
   attempt_count, error_code, created_at, started_at, completed_at, updated_at
      FROM calculation_jobs
      WHERE public_id = ?
      LIMIT 1
    `).bind(validateCalculationJobId(publicId)).first();
    return row ? normalizeCalculationJobRow(row) : null;
  },

  async transition(db, transition) {
    const current = await this.findById(db, transition.publicId);
    if (!current) return { kind: "not-found", job: null };
    if (current.status === transition.nextStatus) return { kind: "idempotent", job: current };
    if (!canTransitionCalculationJob(current.status, transition.nextStatus)) {
      return { kind: "invalid-transition", job: current };
    }
    const runId = transition.githubRunId || null;
    const runAttempt = Number.isSafeInteger(transition.githubRunAttempt)
      ? transition.githubRunAttempt
      : 0;
    const errorCode = transition.nextStatus === "failed"
      ? validateCalculationJobErrorCode(transition.errorCode || "CALCULATION_FAILED")
      : null;
    const result = await db.prepare(`
      UPDATE calculation_jobs SET
        status = ?,
        github_run_id = COALESCE(?, github_run_id),
        github_run_attempt = CASE WHEN ? > github_run_attempt THEN ? ELSE github_run_attempt END,
        attempt_count = CASE WHEN ? = 'running' THEN attempt_count + 1 ELSE attempt_count END,
        error_code = ?,
        started_at = CASE WHEN ? = 'running' THEN COALESCE(started_at, CURRENT_TIMESTAMP) ELSE started_at END,
        completed_at = CASE WHEN ? IN ('succeeded', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE public_id = ? AND status = ?
    `).bind(
      transition.nextStatus,
      runId,
      runAttempt,
      runAttempt,
      transition.nextStatus,
      errorCode,
      transition.nextStatus,
      transition.nextStatus,
      transition.publicId,
      current.status,
    ).run();
    if (affectedRows(result) !== 1) return { kind: "conflict", job: current };
    return { kind: "updated", job: await this.findById(db, transition.publicId) };
  },
});

function buildGitHubDispatchRequest({ token, benchmark, userEmail, jobId = "" }) {
  if (typeof token !== "string" || !token.trim()) {
    throw new RequestValidationError("GitHub dispatch token is required");
  }
  const inputs = {
    custom_benchmark: benchmark,
    target_user_id: userEmail,
  };
  if (jobId) inputs.calculation_job_id = validateCalculationJobId(jobId);
  const owner = encodeURIComponent(GITHUB_DISPATCH.owner);
  const repository = encodeURIComponent(GITHUB_DISPATCH.repository);
  const workflow = encodeURIComponent(GITHUB_DISPATCH.workflow);
  return {
    url: `https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflow}/dispatches`,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "sheet-trading-journal-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: GITHUB_DISPATCH.ref, inputs }),
      signal: AbortSignal.timeout(GITHUB_DISPATCH_TIMEOUT_MS),
    },
  };
}

async function dispatchGitHubWorkflow({ token, benchmark, userEmail, jobId = "", fetchImpl = fetch }) {
  const request = buildGitHubDispatchRequest({ token, benchmark, userEmail, jobId });
  const response = await fetchImpl(request.url, request.init);
  const githubRequestId = sanitizeHeaderValue(response.headers?.get?.("X-GitHub-Request-Id"));
  if (response.ok) return { ok: true, status: response.status, githubRequestId };
  return classifyGitHubDispatchFailure(response.status, {
    githubRequestId,
    retryAfter: sanitizeHeaderValue(response.headers?.get?.("Retry-After")),
  });
}

function classifyGitHubDispatchFailure(status, metadata = {}) {
  const failures = {
    401: ["GITHUB_AUTH_FAILED", "Update service authentication failed", 502],
    403: ["GITHUB_PERMISSION_DENIED", "Update service permission denied", 502],
    404: ["GITHUB_WORKFLOW_NOT_FOUND", "Update workflow is unavailable", 502],
    422: ["GITHUB_DISPATCH_REJECTED", "Update request was rejected", 502],
    429: ["GITHUB_RATE_LIMITED", "Update service is rate limited", 503],
  };
  const selected = failures[status] || (
    status >= 500
      ? ["GITHUB_UNAVAILABLE", "Update service is unavailable", 502]
      : ["GITHUB_UPSTREAM_ERROR", "Failed to trigger update", 502]
  );
  return {
    ok: false,
    status,
    code: selected[0],
    message: selected[1],
    httpStatus: selected[2],
    githubRequestId: metadata.githubRequestId || "",
    retryAfter: metadata.retryAfter || "",
  };
}

function sanitizeHeaderValue(value) {
  return typeof value === "string" ? value.replace(/[^A-Za-z0-9._:\-]/g, "").slice(0, 128) : "";
}

function validateCorsRequest(request, env, requestId) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (!isOriginAllowed(origin, env)) {
    return apiError("ORIGIN_FORBIDDEN", "Origin not allowed", 403, requestId);
  }

  if (request.method !== "OPTIONS") return null;

  const requestedMethod = request.headers.get("Access-Control-Request-Method");
  if (requestedMethod && !CORS_METHODS.includes(requestedMethod.toUpperCase())) {
    return apiError("CORS_METHOD_FORBIDDEN", "CORS method not allowed", 403, requestId);
  }

  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowedHeaders = new Set(CORS_HEADERS.map((value) => value.toLowerCase()));
  if (requestedHeaders.some((header) => !allowedHeaders.has(header))) {
    return apiError("CORS_HEADER_FORBIDDEN", "CORS header not allowed", 403, requestId);
  }
  return null;
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  const metadata = getBuildMetadata(env);
  headers.set("Vary", mergeVary(headers.get("Vary"), "Origin"));
  headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-API-Version", metadata.api_version);
  headers.set("X-Release-Version", metadata.release_version);
  headers.set("X-Schema-Version", String(metadata.schema_version));
  headers.set("X-Source-Commit", metadata.source_commit);
  if (metadata.worker_version?.id) {
    headers.set("X-Worker-Version-Id", metadata.worker_version.id);
  }

  const origin = request.headers.get("Origin");
  if (origin && isOriginAllowed(origin, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", CORS_METHODS.join(", "));
    headers.set("Access-Control-Allow-Headers", CORS_HEADERS.join(", "));
    headers.set("Access-Control-Max-Age", "600");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getAllowedOrigins(env) {
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && value !== "*");
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isOriginAllowed(origin, env) {
  if (getAllowedOrigins(env).has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".sheet-trading-journal.pages.dev")
    );
  } catch {
    return false;
  }
}

function mergeVary(current, value) {
  const values = new Set(
    String(current || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  values.add(value);
  return [...values].join(", ");
}

function resolveRecordScope(principal, targetHeader) {
  if (principal.kind === "user") {
    return { kind: "single-user", userId: principal.email };
  }
  if (targetHeader === null || targetHeader.trim() === "") {
    return { kind: "all-users" };
  }
  return { kind: "single-user", userId: normalizeEmail(targetHeader) };
}

function resolveSettingsTarget(principal, targetHeader) {
  if (principal.kind === "user") return principal.email;
  if (!targetHeader || !targetHeader.trim()) {
    throw new RequestValidationError("X-Target-User is required for system requests");
  }
  return normalizeEmail(targetHeader);
}

function validateTransactionPayload(body, { requireId }) {
  rejectOwnerFields(body);
  const result = {
    txn_date: validateDate(body.txn_date),
    symbol: validateSymbol(body.symbol, "symbol"),
    txn_type: requireString(body.txn_type, "txn_type", 3, 8).toUpperCase(),
    qty: requireFiniteNumber(body.qty, "qty", { minExclusive: 0 }),
    price: requireFiniteNumber(body.price, "price", { minInclusive: 0 }),
    fee: optionalFiniteNumber(body.fee, "fee", 0),
    tax: optionalFiniteNumber(body.tax, "tax", 0),
    tag: sanitizeText(body.tag || "Stock", 500),
    note: sanitizeText(body.note || "", 2_000),
  };

  if (!TXN_TYPES.has(result.txn_type)) {
    throw new RequestValidationError("txn_type must be BUY, SELL, or DIV");
  }
  if (requireId) result.id = requirePositiveInteger(body.id, "id");
  return result;
}

function rejectOwnerFields(body) {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_OWNER_FIELDS.has(key)) {
      throw new RequestValidationError(`${key} is not accepted from this client`);
    }
  }
}

async function readJsonObject(request, { allowEmpty = false } = {}) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RequestValidationError("Content-Type must be application/json");
  }

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new RequestValidationError("Request body is too large");
  }

  const text = await request.text();
  if (!text.trim()) {
    if (allowEmpty) return {};
    throw new RequestValidationError("JSON body is required");
  }
  if (byteLength(text) > MAX_JSON_BYTES) {
    throw new RequestValidationError("Request body is too large");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RequestValidationError("Malformed JSON body");
  }
  if (!isPlainObject(parsed)) {
    throw new RequestValidationError("JSON body must be an object");
  }
  return parsed;
}

async function verifyGoogleToken(token, audience) {
  if (typeof token !== "string" || token.length < 20 || token.length > MAX_TOKEN_LENGTH) {
    throw new Error("Invalid token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  validateGoogleClaims(header, payload, audience);

  const keysResponse = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: "application/json" },
  });
  if (!keysResponse.ok) throw new Error("Token key service unavailable");
  const keys = await keysResponse.json();
  const key = Array.isArray(keys?.keys)
    ? keys.keys.find((candidate) => candidate.kid === header.kid)
    : null;
  if (!key) throw new Error("Signing key unavailable");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error("Invalid signature");
  return payload;
}

function validateGoogleClaims(header, payload, audience, now = Math.floor(Date.now() / 1000)) {
  if (!isPlainObject(header) || header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Invalid token header");
  }
  if (!isPlainObject(payload)) throw new Error("Invalid token claims");

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) throw new Error("Invalid audience");
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error("Invalid issuer");
  if (!Number.isInteger(payload.exp) || payload.exp <= now - 30) throw new Error("Expired token");
  if (payload.iat !== undefined && (!Number.isInteger(payload.iat) || payload.iat > now + 300)) {
    throw new Error("Invalid issued-at time");
  }
  if (typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 255) {
    throw new Error("Invalid subject");
  }
  if (payload.email_verified !== true) throw new Error("Email is not verified");
  normalizeEmail(payload.email);
}

function decodeJwtPart(part) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  } catch {
    throw new Error("Invalid token encoding");
  }
}

function base64UrlDecode(value) {
  let normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  const leftBytes = new TextEncoder().encode(String(left));
  const rightBytes = new TextEncoder().encode(String(right));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

async function claimTriggerSlot(email, env, ctx) {
  const cache = env.RATE_LIMIT_CACHE || globalThis.caches?.default;
  if (!cache) return { allowed: true, retryAfter: 0 };

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const key = new Request(`https://rate-limit.invalid/trigger/${hash}`, { method: "GET" });
  const existing = await cache.match(key);
  if (existing) return { allowed: false, retryAfter: TRIGGER_COOLDOWN_SECONDS };

  const marker = new Response("1", {
    headers: { "Cache-Control": `max-age=${TRIGGER_COOLDOWN_SECONDS}` },
  });
  const write = cache.put(key, marker);
  if (ctx?.waitUntil) ctx.waitUntil(write);
  else await write;
  return { allowed: true, retryAfter: 0 };
}

function validateDate(value) {
  const text = requireString(value, "txn_date", 10, 10);
  if (!DATE_RE.test(text)) throw new RequestValidationError("txn_date must use YYYY-MM-DD");
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RequestValidationError("txn_date is not a valid date");
  }
  return text;
}

function validateSymbol(value, fieldName) {
  const symbol = requireString(value, fieldName, 1, 24).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    throw new RequestValidationError(`${fieldName} has an invalid format`);
  }
  return symbol;
}

function normalizeEmail(value) {
  const email = requireString(value, "email", 3, 320).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new RequestValidationError("Invalid email address");
  return email;
}

function requireString(value, fieldName, minLength, maxLength) {
  if (typeof value !== "string") {
    throw new RequestValidationError(`${fieldName} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new RequestValidationError(`${fieldName} has an invalid length`);
  }
  return normalized;
}

function sanitizeText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new RequestValidationError("Text field is too long");
  return text;
}

function requireFiniteNumber(value, fieldName, limits = {}) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new RequestValidationError(`${fieldName} must be a finite number`);
  }
  if (limits.minExclusive !== undefined && number <= limits.minExclusive) {
    throw new RequestValidationError(`${fieldName} must be greater than ${limits.minExclusive}`);
  }
  if (limits.minInclusive !== undefined && number < limits.minInclusive) {
    throw new RequestValidationError(`${fieldName} must be at least ${limits.minInclusive}`);
  }
  return number;
}

function optionalFiniteNumber(value, fieldName, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return requireFiniteNumber(value, fieldName, { minInclusive: 0 });
}

function requireNonNegativeInteger(value, fieldName) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RequestValidationError(`${fieldName} must be a non-negative integer`);
  }
  return number;
}

function requirePositiveInteger(value, fieldName) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new RequestValidationError(`${fieldName} must be a positive integer`);
  }
  return number;
}

function mutationError(error, requestId, genericMessage) {
  if (error instanceof RequestValidationError) {
    return apiError("INVALID_REQUEST", error.message, 400, requestId);
  }
  console.error(`[request_id=${requestId}] ${genericMessage}`, safeErrorName(error));
  return apiError("DATABASE_ERROR", genericMessage, 500, requestId);
}

function affectedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function emptyPortfolio() {
  return { summary: {}, holdings: [], history: [] };
}

function methodNotAllowed(requestId) {
  return apiError("METHOD_NOT_ALLOWED", "Method not allowed", 405, requestId);
}

function apiError(code, message, status, requestId) {
  return jsonResponse(
    {
      success: false,
      error: message,
      error_meta: {
        code,
        request_id: requestId,
      },
    },
    status,
  );
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function safeErrorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export const __test = {
  API_VERSION,
  RELEASE_VERSION,
  REQUIRED_SCHEMA_VERSION,
  authorize,
  getBuildMetadata,
  handleHealth,
  buildGitHubDispatchRequest,
  handleGetCalculationJob,
  handleCalculationJobStatus,
  resolveIdempotencyKey,
  validateIdempotencyKey,
  hashCalculationJobIdempotency,
  createCalculationJobId,
  validateCalculationJobId,
  canTransitionCalculationJob,
  publicCalculationJob,
  calculationJobsRepository,
  classifyGitHubDispatchFailure,
  dispatchGitHubWorkflow,
  constantTimeEqual,
  getAllowedOrigins,
  isOriginAllowed,
  resolveRecordScope,
  resolveSettingsTarget,
  parseRecordPageRequest,
  encodeRecordCursor,
  decodeRecordCursor,
  recordsRepository,
  validateCorsRequest,
  validateGoogleClaims,
  validateTransactionPayload,
  withCors,
};
