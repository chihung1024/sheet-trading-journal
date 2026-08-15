import {
  buildDividendEventIdempotencyKey,
  isDividendEventIdempotencyKey,
  normalizeDividendEventIdentity,
} from './shared/dividendEventIdentity.js';

const MAX_SPECIAL_JSON_BYTES = 16_384;
const ALLOWED_FIELDS = new Set([
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
  'note',
]);
const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, Idempotency-Key';

const affectedRows = result => {
  const value = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

const isPlainObject = value => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype
);

const finiteNumber = (value, field, { minInclusive = null } = {}) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DividendEventRequestError(`${field} must be a finite number`);
  }
  if (minInclusive !== null && value < minInclusive) {
    throw new DividendEventRequestError(`${field} must be at least ${minInclusive}`);
  }
  return value;
};

const normalizeSpecialPayload = body => {
  if (!isPlainObject(body)) throw new DividendEventRequestError('Request body must be a JSON object');
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new DividendEventRequestError(`Unexpected field: ${key}`);
    }
  }

  const identity = normalizeDividendEventIdentity({
    symbol: body.symbol,
    date: body.txn_date,
  });
  if (!identity) throw new DividendEventRequestError('Dividend symbol/date identity is invalid');
  if (String(body.txn_type || '').trim().toUpperCase() !== 'DIV') {
    throw new DividendEventRequestError('txn_type must be DIV');
  }

  const qty = finiteNumber(body.qty, 'qty', { minInclusive: 0 });
  const price = finiteNumber(body.price, 'price', { minInclusive: 0 });
  const fee = finiteNumber(body.fee ?? 0, 'fee');
  const tax = finiteNumber(body.tax ?? 0, 'tax');
  const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (qty !== 1) throw new DividendEventRequestError('Automatic dividend qty must be 1');
  if (fee !== 0 || tax !== 0) {
    throw new DividendEventRequestError('Automatic dividend fee/tax fields must be zero');
  }
  if (tag !== 'Auto-Dividend') {
    throw new DividendEventRequestError('Automatic dividend tag is invalid');
  }
  if (note.length > 2_000) throw new DividendEventRequestError('note is too long');

  return Object.freeze({
    txn_date: identity.date,
    symbol: identity.symbol,
    txn_type: 'DIV',
    qty,
    price,
    fee,
    tax,
    tag,
    note,
  });
};

const readJsonBody = async request => {
  const text = await request.clone().text();
  if (new TextEncoder().encode(text).byteLength > MAX_SPECIAL_JSON_BYTES) {
    throw new DividendEventRequestError('Request body is too large');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new DividendEventRequestError('Request body must be valid JSON');
  }
};

const authenticateUser = async (request, env, ctx, canonicalWorker) => {
  const authorization = request.headers.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const authUrl = new URL('/auth/google', request.url);
  const authResponse = await canonicalWorker.fetch(new Request(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: match[1] }),
  }), env, ctx);
  if (!authResponse.ok) return null;

  try {
    const body = await authResponse.json();
    return typeof body?.email === 'string' && body.email ? body.email : null;
  } catch {
    return null;
  }
};

const currentRowPayload = row => ({
  txn_date: row.txn_date,
  symbol: row.symbol,
  txn_type: row.txn_type,
  qty: Number(row.qty),
  price: Number(row.price),
  fee: Number(row.fee ?? 0),
  tax: Number(row.tax ?? 0),
  tag: String(row.tag ?? ''),
  note: String(row.note ?? ''),
});

export const ensureDividendEventRecord = async (
  db,
  userId,
  body,
  idempotencyKey,
  canonicalTest,
) => {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') {
    throw new Error('D1 batch support is required');
  }
  if (typeof userId !== 'string' || !userId) throw new Error('Verified user identity is required');

  const expectedKey = await buildDividendEventIdempotencyKey({
    symbol: body.symbol,
    date: body.txn_date,
  });
  if (idempotencyKey !== expectedKey) {
    throw new DividendEventRequestError('Dividend event idempotency key does not match the record event');
  }

  const idempotencyHash = await canonicalTest.hashRecordCreateIdempotency(userId, idempotencyKey);
  const payloadHash = await canonicalTest.hashRecordCreatePayload(body);

  const statements = [
    db.prepare(`
      UPDATE records
      SET create_idempotency_hash = NULL, create_payload_hash = NULL
      WHERE user_id = ?
        AND create_idempotency_hash = ?
        AND NOT (txn_type = 'DIV' AND symbol = ? AND txn_date = ?)
    `).bind(userId, idempotencyHash, body.symbol, body.txn_date),
    db.prepare(`
      INSERT OR IGNORE INTO records (
        user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note,
        create_idempotency_hash, create_payload_hash
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM records
        WHERE user_id = ? AND txn_type = 'DIV' AND symbol = ? AND txn_date = ?
      )
    `).bind(
      userId,
      body.txn_date,
      body.symbol,
      body.txn_type,
      body.qty,
      body.price,
      body.fee,
      body.tax,
      body.tag,
      body.note,
      idempotencyHash,
      payloadHash,
      userId,
      body.symbol,
      body.txn_date,
    ),
  ];

  const results = await db.batch(statements);
  const inserted = affectedRows(results?.[1]) === 1;
  const eventRows = await db.prepare(`
    SELECT id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note
    FROM records
    WHERE user_id = ? AND txn_type = 'DIV' AND symbol = ? AND txn_date = ?
    ORDER BY id ASC
  `).bind(userId, body.symbol, body.txn_date).all();
  const rows = Array.isArray(eventRows?.results) ? eventRows.results : [];
  if (rows.length === 0) throw new Error('Dividend event write could not be observed');

  let matchingRow = null;
  for (const row of rows) {
    if (await canonicalTest.hashRecordCreatePayload(currentRowPayload(row)) === payloadHash) {
      matchingRow = row;
      break;
    }
  }

  return Object.freeze({
    inserted,
    payloadMatched: matchingRow !== null,
    recordId: Number((matchingRow || rows[0]).id) || null,
  });
};

export const tryHandleDividendEventCreate = async (
  request,
  env,
  ctx,
  {
    canonicalWorker,
    canonicalTest,
    isOriginAllowed,
  },
) => {
  if (request?.method !== 'POST') return null;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (url.pathname !== '/api/records' && url.pathname !== '/api/records/idempotent') return null;

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!isDividendEventIdempotencyKey(idempotencyKey)) return null;

  const requestId = crypto.randomUUID();
  const origin = request.headers.get('Origin');
  if (origin && !isOriginAllowed(origin, env)) {
    return withEntryCors(apiResponse(false, 'Origin not allowed', 403, 'ORIGIN_FORBIDDEN', requestId), request, env, canonicalTest);
  }

  const email = await authenticateUser(request, env, ctx, canonicalWorker);
  if (!email) {
    return withEntryCors(
      apiResponse(false, 'Authentication required', 401, 'UNAUTHORIZED', requestId),
      request,
      env,
      canonicalTest,
    );
  }

  try {
    const body = normalizeSpecialPayload(await readJsonBody(request));
    const result = await ensureDividendEventRecord(
      env.DB,
      email,
      body,
      idempotencyKey,
      canonicalTest,
    );

    if (!result.payloadMatched) {
      return withEntryCors(
        apiResponse(
          false,
          '此配息已由既有交易紀錄確認，本次輸入未重複新增',
          409,
          'DIVIDEND_EVENT_CONFLICT',
          requestId,
          { record_id: result.recordId },
        ),
        request,
        env,
        canonicalTest,
      );
    }

    return withEntryCors(
      jsonResponse({
        success: true,
        deduplicated: !result.inserted,
        record_id: result.recordId,
        semantic_event: 'dividend-v1',
      }),
      request,
      env,
      canonicalTest,
    );
  } catch (error) {
    if (error instanceof DividendEventRequestError) {
      return withEntryCors(
        apiResponse(false, error.message, 400, 'INVALID_DIVIDEND_EVENT_REQUEST', requestId),
        request,
        env,
        canonicalTest,
      );
    }
    console.error(`[request_id=${requestId}] Dividend event create failed`, error?.name || 'Error');
    return withEntryCors(
      apiResponse(false, 'Record creation failed', 500, 'DATABASE_ERROR', requestId),
      request,
      env,
      canonicalTest,
    );
  }
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

const apiResponse = (success, message, status, code, requestId, extra = {}) => jsonResponse({
  success,
  error: success ? undefined : message,
  error_meta: success ? undefined : { code, request_id: requestId },
  ...extra,
}, status);

const withEntryCors = (response, request, env, canonicalTest) => {
  const headers = new Headers(response.headers);
  const metadata = canonicalTest.getBuildMetadata(env);
  headers.set('Vary', 'Origin');
  headers.set('Cache-Control', headers.get('Cache-Control') || 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Release-Version', metadata.release_version);
  headers.set('X-API-Version', metadata.api_version);
  headers.set('X-Schema-Version', String(metadata.schema_version));
  headers.set('X-Source-Commit', metadata.source_commit);
  if (metadata.worker_version?.id) headers.set('X-Worker-Version-Id', metadata.worker_version.id);

  const origin = request.headers.get('Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', CORS_METHODS);
    headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
    headers.set('Access-Control-Max-Age', '600');
  }
  return new Response(response.body, { status: response.status, headers });
};

class DividendEventRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DividendEventRequestError';
  }
}

export const __test = Object.freeze({
  normalizeSpecialPayload,
  currentRowPayload,
  readJsonBody,
  authenticateUser,
  affectedRows,
});
