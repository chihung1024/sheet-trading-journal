const RESTORE_PATH = '/api/journal-restore';
const BACKUP_FORMAT = 'sheet-trading-journal-backup';
const BACKUP_SCHEMA_VERSION = 1;
const MAX_RESTORE_JSON_BYTES = 16 * 1024 * 1024;
const MAX_COLLECTION_ROWS = 100_000;
const MAX_D1_JSON_CHUNK_BYTES = 750_000;
const MAX_D1_BATCH_STATEMENTS = 48;
const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, Idempotency-Key';

const BACKUP_FIELDS = Object.freeze([
  'format',
  'schema_version',
  'generated_at',
  'authority',
  'counts',
  'records',
  'cash_events',
]);
const AUTHORITY_FIELDS = Object.freeze([
  'records',
  'cash_events',
  'derived_portfolio_snapshot_included',
  'browser_local_state_included',
]);
const COUNT_FIELDS = Object.freeze(['records', 'cash_events']);
const RECORD_BACKUP_FIELDS = Object.freeze([
  'id',
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
  'note',
  'created_at',
  'currency',
  'executed_at',
  'execution_sequence',
  'event_source',
]);
const RECORD_PORTABLE_FIELDS = Object.freeze([
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
  'note',
  'currency',
  'executed_at',
  'execution_sequence',
  'event_source',
]);
const CASH_BACKUP_FIELDS = Object.freeze([
  'id',
  'event_date',
  'event_type',
  'amount',
  'currency',
  'note',
  'event_source',
  'created_at',
  'updated_at',
]);
const CASH_PORTABLE_FIELDS = Object.freeze([
  'event_date',
  'event_type',
  'amount',
  'currency',
  'note',
  'event_source',
]);
const CASH_EVENT_SOURCES = new Set(['MANUAL', 'IBKR', 'IMPORT', 'SYSTEM']);

const textEncoder = new TextEncoder();
const byteLength = value => textEncoder.encode(String(value)).byteLength;
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

const requireExactFields = (value, expectedFields, label) => {
  if (!isPlainObject(value)) throw new JournalRestoreRequestError(`${label} must be an object`);
  const expected = new Set(expectedFields);
  const unknown = Object.keys(value).filter(key => !expected.has(key));
  const missing = expectedFields.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (unknown.length || missing.length) {
    const details = [];
    if (unknown.length) details.push(`unsupported fields: ${unknown.sort().join(', ')}`);
    if (missing.length) details.push(`missing fields: ${missing.sort().join(', ')}`);
    throw new JournalRestoreRequestError(`${label} ${details.join('; ')}`);
  }
  return value;
};

const requirePositiveSourceId = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new JournalRestoreRequestError(`${label} must be a positive integer`);
  }
  return value;
};

const requireTimestampText = (value, label) => {
  if (typeof value !== 'string' || !value || value.length > 64) {
    throw new JournalRestoreRequestError(`${label} is invalid`);
  }
  return value;
};

const requireCashEventSource = (value, label) => {
  if (value === null) return null;
  if (typeof value !== 'string' || value !== value.toUpperCase() || !CASH_EVENT_SOURCES.has(value)) {
    throw new JournalRestoreRequestError(`${label} is not a reviewed source token`);
  }
  return value;
};

const assertCanonicalRecord = (raw, canonical, index) => {
  for (const field of RECORD_PORTABLE_FIELDS) {
    const source = raw[field] ?? null;
    const normalized = canonical[field] ?? null;
    if (source !== normalized) {
      throw new JournalRestoreRequestError(`backup.records[${index}].${field} is not canonical`);
    }
  }
};

const normalizeRecord = (raw, index, canonicalTest) => {
  const value = requireExactFields(raw, RECORD_BACKUP_FIELDS, `backup.records[${index}]`);
  requirePositiveSourceId(value.id, `backup.records[${index}].id`);
  requireTimestampText(value.created_at, `backup.records[${index}].created_at`);

  let canonical;
  try {
    canonical = canonicalTest.validateTransactionPayload(
      Object.fromEntries(RECORD_PORTABLE_FIELDS.map(field => [field, value[field]])),
      { requireId: false },
    );
  } catch (error) {
    throw new JournalRestoreRequestError(
      `backup.records[${index}] is invalid: ${error?.message || 'record validation failed'}`,
    );
  }
  assertCanonicalRecord(value, canonical, index);
  return Object.freeze(Object.fromEntries(RECORD_PORTABLE_FIELDS.map(field => [field, canonical[field]])));
};

const normalizeCashEvent = (raw, index, canonicalTest) => {
  const value = requireExactFields(raw, CASH_BACKUP_FIELDS, `backup.cash_events[${index}]`);
  requirePositiveSourceId(value.id, `backup.cash_events[${index}].id`);
  requireTimestampText(value.created_at, `backup.cash_events[${index}].created_at`);
  requireTimestampText(value.updated_at, `backup.cash_events[${index}].updated_at`);
  const eventSource = requireCashEventSource(value.event_source, `backup.cash_events[${index}].event_source`);

  let canonical;
  try {
    canonical = canonicalTest.validateCashEventCreatePayload({
      event_date: value.event_date,
      event_type: value.event_type,
      amount: value.amount,
      currency: value.currency,
      note: value.note,
    });
  } catch (error) {
    throw new JournalRestoreRequestError(
      `backup.cash_events[${index}] is invalid: ${error?.message || 'cash-event validation failed'}`,
    );
  }

  for (const field of ['event_date', 'event_type', 'amount', 'currency', 'note']) {
    if (value[field] !== canonical[field]) {
      throw new JournalRestoreRequestError(`backup.cash_events[${index}].${field} is not canonical`);
    }
  }
  return Object.freeze({ ...canonical, event_source: eventSource });
};

export const normalizeJournalRestoreBackup = (backup, canonicalTest) => {
  if (!canonicalTest?.validateTransactionPayload || !canonicalTest?.validateCashEventCreatePayload) {
    throw new TypeError('Canonical Worker validators are required');
  }
  const value = requireExactFields(backup, BACKUP_FIELDS, 'backup');
  if (value.format !== BACKUP_FORMAT) throw new JournalRestoreRequestError('backup format is unsupported');
  if (value.schema_version !== BACKUP_SCHEMA_VERSION) {
    throw new JournalRestoreRequestError(`backup schema version ${String(value.schema_version)} is unsupported`);
  }
  if (typeof value.generated_at !== 'string' || !Number.isFinite(Date.parse(value.generated_at))) {
    throw new JournalRestoreRequestError('backup.generated_at is invalid');
  }

  const authority = requireExactFields(value.authority, AUTHORITY_FIELDS, 'backup.authority');
  if (
    authority.records !== 'authenticated_tenant_scoped_api_readback'
    || authority.cash_events !== 'authenticated_tenant_scoped_api_readback'
    || authority.derived_portfolio_snapshot_included !== false
    || authority.browser_local_state_included !== false
  ) {
    throw new JournalRestoreRequestError('backup authority manifest is unsupported');
  }

  const counts = requireExactFields(value.counts, COUNT_FIELDS, 'backup.counts');
  for (const field of COUNT_FIELDS) {
    if (!Number.isSafeInteger(counts[field]) || counts[field] < 0) {
      throw new JournalRestoreRequestError(`backup.counts.${field} is invalid`);
    }
  }
  if (!Array.isArray(value.records) || !Array.isArray(value.cash_events)) {
    throw new JournalRestoreRequestError('backup collections must be arrays');
  }
  if (value.records.length > MAX_COLLECTION_ROWS || value.cash_events.length > MAX_COLLECTION_ROWS) {
    throw new JournalRestoreRequestError('backup collection exceeds the restore safety limit', {
      code: 'RESTORE_TOO_LARGE',
      status: 413,
    });
  }
  if (counts.records !== value.records.length || counts.cash_events !== value.cash_events.length) {
    throw new JournalRestoreRequestError('backup counts do not match collection lengths');
  }

  const recordIds = new Set();
  const records = value.records.map((row, index) => {
    const id = requirePositiveSourceId(row?.id, `backup.records[${index}].id`);
    if (recordIds.has(id)) throw new JournalRestoreRequestError(`backup contains duplicate record id ${id}`);
    recordIds.add(id);
    return normalizeRecord(row, index, canonicalTest);
  });

  const cashIds = new Set();
  const openingCurrencies = new Set();
  const cashEvents = value.cash_events.map((row, index) => {
    const id = requirePositiveSourceId(row?.id, `backup.cash_events[${index}].id`);
    if (cashIds.has(id)) throw new JournalRestoreRequestError(`backup contains duplicate cash event id ${id}`);
    cashIds.add(id);
    const event = normalizeCashEvent(row, index, canonicalTest);
    if (event.event_type === 'OPENING_BALANCE') {
      if (openingCurrencies.has(event.currency)) {
        throw new JournalRestoreRequestError(`backup contains multiple opening balances for ${event.currency}`);
      }
      openingCurrencies.add(event.currency);
    }
    return event;
  });

  return Object.freeze({
    format: BACKUP_FORMAT,
    schema_version: BACKUP_SCHEMA_VERSION,
    records: Object.freeze(records),
    cash_events: Object.freeze(cashEvents),
  });
};

const canonicalMultiset = rows => rows.map(row => JSON.stringify(row)).sort();

export const hashJournalRestorePayload = async normalizedBackup => sha256Hex(
  `journal-restore-payload-v1\n${JSON.stringify({
    format: normalizedBackup.format,
    schema_version: normalizedBackup.schema_version,
    records: canonicalMultiset(normalizedBackup.records),
    cash_events: canonicalMultiset(normalizedBackup.cash_events),
  })}`,
);

export const hashJournalRestoreIdempotency = async (userId, idempotencyKey, canonicalTest) => {
  const key = canonicalTest.validateIdempotencyKey(idempotencyKey);
  return sha256Hex(`journal-restore-idempotency-v1\n${String(userId).trim().toLowerCase()}\n${key}`);
};

const splitJsonChunks = rows => {
  if (rows.length === 0) return [];
  const chunks = [];
  let current = [];
  let currentBytes = 2;

  for (const row of rows) {
    const serialized = JSON.stringify(row);
    const addedBytes = byteLength(serialized) + (current.length ? 1 : 0);
    if (addedBytes + 2 > MAX_D1_JSON_CHUNK_BYTES) {
      if (current.length === 0) {
        throw new JournalRestoreRequestError('A restore row exceeds the D1 chunk safety limit', {
          code: 'RESTORE_TOO_LARGE',
          status: 413,
        });
      }
      chunks.push(JSON.stringify(current));
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += byteLength(serialized) + (current.length > 1 ? 1 : 0);
  }
  if (current.length) chunks.push(JSON.stringify(current));
  return chunks;
};

export const buildJournalRestoreBatch = ({ db, userId, idempotencyHash, payloadHash, backup }) => {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') {
    throw new Error('D1 batch support is required');
  }

  const recordChunks = splitJsonChunks(backup.records);
  const cashChunks = splitJsonChunks(backup.cash_events);
  const statements = [
    db.prepare(`
      INSERT OR IGNORE INTO journal_restore_sessions (
        user_id, idempotency_hash, payload_hash, backup_schema_version,
        expected_record_count, expected_cash_event_count, status
      )
      SELECT ?, ?, ?, ?, ?, ?, 'pending'
      WHERE NOT EXISTS (SELECT 1 FROM records WHERE user_id = ?)
        AND NOT EXISTS (SELECT 1 FROM cash_events WHERE user_id = ?)
    `).bind(
      userId,
      idempotencyHash,
      payloadHash,
      backup.schema_version,
      backup.records.length,
      backup.cash_events.length,
      userId,
      userId,
    ),
  ];

  for (const chunk of recordChunks) {
    statements.push(db.prepare(`
      INSERT INTO records (
        user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note,
        currency, executed_at, execution_sequence, event_source
      )
      SELECT
        ?,
        json_extract(item.value, '$.txn_date'),
        json_extract(item.value, '$.symbol'),
        json_extract(item.value, '$.txn_type'),
        json_extract(item.value, '$.qty'),
        json_extract(item.value, '$.price'),
        json_extract(item.value, '$.fee'),
        json_extract(item.value, '$.tax'),
        json_extract(item.value, '$.tag'),
        json_extract(item.value, '$.note'),
        json_extract(item.value, '$.currency'),
        json_extract(item.value, '$.executed_at'),
        json_extract(item.value, '$.execution_sequence'),
        json_extract(item.value, '$.event_source')
      FROM json_each(?) AS item
      WHERE EXISTS (
        SELECT 1 FROM journal_restore_sessions
        WHERE user_id = ? AND idempotency_hash = ? AND payload_hash = ? AND status = 'pending'
      )
    `).bind(userId, chunk, userId, idempotencyHash, payloadHash));
  }

  for (const chunk of cashChunks) {
    statements.push(db.prepare(`
      INSERT INTO cash_events (
        user_id, event_date, event_type, amount, currency, note, event_source
      )
      SELECT
        ?,
        json_extract(item.value, '$.event_date'),
        json_extract(item.value, '$.event_type'),
        json_extract(item.value, '$.amount'),
        json_extract(item.value, '$.currency'),
        json_extract(item.value, '$.note'),
        json_extract(item.value, '$.event_source')
      FROM json_each(?) AS item
      WHERE EXISTS (
        SELECT 1 FROM journal_restore_sessions
        WHERE user_id = ? AND idempotency_hash = ? AND payload_hash = ? AND status = 'pending'
      )
    `).bind(userId, chunk, userId, idempotencyHash, payloadHash));
  }

  statements.push(db.prepare(`
    UPDATE journal_restore_sessions
    SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      completion_guard = CASE
        WHEN (SELECT COUNT(*) FROM records WHERE user_id = ?) = expected_record_count
         AND (SELECT COUNT(*) FROM cash_events WHERE user_id = ?) = expected_cash_event_count
        THEN 1
        ELSE 0
      END
    WHERE user_id = ?
      AND idempotency_hash = ?
      AND payload_hash = ?
      AND status = 'pending'
  `).bind(userId, userId, userId, idempotencyHash, payloadHash));

  statements.push(db.prepare(`
    SELECT idempotency_hash, payload_hash, status,
           expected_record_count, expected_cash_event_count
    FROM journal_restore_sessions
    WHERE user_id = ? AND idempotency_hash = ?
    LIMIT 1
  `).bind(userId, idempotencyHash));

  if (statements.length > MAX_D1_BATCH_STATEMENTS) {
    throw new JournalRestoreRequestError('Backup requires too many atomic D1 statements', {
      code: 'RESTORE_TOO_LARGE',
      status: 413,
    });
  }
  return Object.freeze(statements);
};

export const applyAtomicJournalRestore = async ({ db, userId, idempotencyKey, backup, canonicalTest }) => {
  const idempotencyHash = await hashJournalRestoreIdempotency(userId, idempotencyKey, canonicalTest);
  const payloadHash = await hashJournalRestorePayload(backup);
  const statements = buildJournalRestoreBatch({ db, userId, idempotencyHash, payloadHash, backup });
  const results = await db.batch(statements);
  const sessionCreated = affectedRows(results?.[0]) === 1;
  const sessionResult = results?.[results.length - 1];
  const session = Array.isArray(sessionResult?.results) ? sessionResult.results[0] : null;

  if (!session) {
    return Object.freeze({ kind: 'destination-not-empty', payloadHash });
  }
  if (session.payload_hash !== payloadHash) {
    return Object.freeze({ kind: 'idempotency-conflict', payloadHash });
  }
  if (session.status !== 'completed') {
    return Object.freeze({ kind: 'incomplete', payloadHash });
  }

  return Object.freeze({
    kind: sessionCreated ? 'restored' : 'replayed',
    payloadHash,
    counts: Object.freeze({
      records: Number(session.expected_record_count),
      cash_events: Number(session.expected_cash_event_count),
    }),
  });
};

const readRestoreBackup = async request => {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new JournalRestoreRequestError('Content-Type must be application/json');
  }
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESTORE_JSON_BYTES) {
    throw new JournalRestoreRequestError('Restore request body is too large', {
      code: 'RESTORE_TOO_LARGE',
      status: 413,
    });
  }
  const text = await request.clone().text();
  if (byteLength(text) > MAX_RESTORE_JSON_BYTES) {
    throw new JournalRestoreRequestError('Restore request body is too large', {
      code: 'RESTORE_TOO_LARGE',
      status: 413,
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new JournalRestoreRequestError('Restore request body must be valid JSON');
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

export const tryHandleJournalRestore = async (
  request,
  env,
  ctx,
  { canonicalWorker, canonicalTest, isOriginAllowed },
) => {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (url.pathname !== RESTORE_PATH) return null;

  const requestId = crypto.randomUUID();
  const origin = request.headers.get('Origin');
  if (origin && !isOriginAllowed(origin, env)) {
    return withEntryCors(
      apiError('ORIGIN_FORBIDDEN', 'Origin not allowed', 403, requestId),
      request,
      env,
      canonicalTest,
    );
  }
  if (request.method === 'OPTIONS') {
    return withEntryCors(new Response(null, { status: 204 }), request, env, canonicalTest);
  }
  if (request.method !== 'POST') {
    return withEntryCors(
      apiError('METHOD_NOT_ALLOWED', 'Method not allowed', 405, requestId),
      request,
      env,
      canonicalTest,
    );
  }

  const email = await authenticateUser(request, env, ctx, canonicalWorker);
  if (!email) {
    return withEntryCors(
      apiError('UNAUTHORIZED', 'Authentication required', 401, requestId),
      request,
      env,
      canonicalTest,
    );
  }

  try {
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) throw new JournalRestoreRequestError('Idempotency-Key is required');
    canonicalTest.validateIdempotencyKey(idempotencyKey);
    const backup = normalizeJournalRestoreBackup(await readRestoreBackup(request), canonicalTest);
    const result = await applyAtomicJournalRestore({
      db: env.DB,
      userId: email,
      idempotencyKey,
      backup,
      canonicalTest,
    });

    if (result.kind === 'destination-not-empty') {
      return withEntryCors(
        apiError(
          'RESTORE_DESTINATION_NOT_EMPTY',
          'Restore is allowed only when transaction and cash-event collections are empty',
          409,
          requestId,
        ),
        request,
        env,
        canonicalTest,
      );
    }
    if (result.kind === 'idempotency-conflict') {
      return withEntryCors(
        apiError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used for a different restore payload',
          409,
          requestId,
        ),
        request,
        env,
        canonicalTest,
      );
    }
    if (result.kind === 'incomplete') {
      throw new Error('Restore session did not reach completed state');
    }

    return withEntryCors(jsonResponse({
      success: true,
      restored: result.kind === 'restored',
      deduplicated: result.kind === 'replayed',
      counts: result.counts,
      verification_required: true,
    }, result.kind === 'restored' ? 201 : 200), request, env, canonicalTest);
  } catch (error) {
    if (error instanceof JournalRestoreRequestError) {
      return withEntryCors(
        apiError(error.code, error.message, error.status, requestId),
        request,
        env,
        canonicalTest,
      );
    }
    const message = String(error?.message || '');
    const schemaMissing = /no such table:\s*journal_restore_sessions/i.test(message);
    console.error(`[request_id=${requestId}] Journal restore failed`, error?.name || 'Error');
    return withEntryCors(
      apiError(
        schemaMissing ? 'RESTORE_SCHEMA_UNAVAILABLE' : 'RESTORE_DATABASE_ERROR',
        schemaMissing ? 'Restore storage is not ready' : 'Atomic restore failed',
        schemaMissing ? 503 : 500,
        requestId,
      ),
      request,
      env,
      canonicalTest,
    );
  }
};

const sha256Hex = async material => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(material));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

const apiError = (code, message, status, requestId) => jsonResponse({
  success: false,
  error: message,
  error_meta: { code, request_id: requestId },
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

class JournalRestoreRequestError extends Error {
  constructor(message, { code = 'INVALID_RESTORE_REQUEST', status = 400 } = {}) {
    super(message);
    this.name = 'JournalRestoreRequestError';
    this.code = code;
    this.status = status;
  }
}

export const __test = Object.freeze({
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  MAX_RESTORE_JSON_BYTES,
  MAX_D1_JSON_CHUNK_BYTES,
  MAX_D1_BATCH_STATEMENTS,
  normalizeRecord,
  normalizeCashEvent,
  splitJsonChunks,
  affectedRows,
  readRestoreBackup,
  authenticateUser,
  JournalRestoreRequestError,
});
