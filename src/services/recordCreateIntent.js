import {
  PENDING_RECORD_CREATE_V1_STORAGE_PREFIX,
  RECORD_MUTATION_BARRIER_STORAGE_KEY,
} from './projectStorage.js';

export const RECORD_CREATE_INTENT_VERSION = 1;
export const RECORD_CREATE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
export const RECORD_CREATE_RECONCILIATION_WINDOW_MS = 60 * 1000;
export const RECORD_CREATE_INTENT_STATE = Object.freeze({
  LIVE: 'live',
  TERMINAL: 'terminal',
});

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const OPAQUE_ID_RE = /^[A-Za-z0-9._-]{16,128}$/;
const RECORD_CREATE_IDEMPOTENCY_KEY = Symbol('recordCreateIdempotencyKey');

const requireStorage = (storage) => {
  if (
    !storage
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function'
  ) {
    throw new TypeError('A readable/writable Storage-compatible object is required');
  }
  return storage;
};

export const normalizeRecordCreateOwner = (owner) => {
  if (typeof owner !== 'string' || !owner.trim()) {
    throw new Error('A signed tenant owner is required for record-create recovery');
  }
  return owner.trim().toLowerCase();
};

const defaultCreateOpaqueId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random ID generation is unavailable');
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

const assertOpaqueId = (value, label) => {
  if (typeof value !== 'string' || !OPAQUE_ID_RE.test(value)) {
    throw new Error(`${label} must be a stable opaque identifier`);
  }
  return value;
};

export const withRecordCreateIdempotencyKey = (payload, idempotencyKey) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Record-create payload must be an object');
  }
  const decorated = { ...payload };
  Object.defineProperty(decorated, RECORD_CREATE_IDEMPOTENCY_KEY, {
    value: assertOpaqueId(idempotencyKey, 'Record-create idempotency key'),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return decorated;
};

const verifiedSetJson = (storage, key, value) => {
  const target = requireStorage(storage);
  const encoded = JSON.stringify(value);
  target.setItem(key, encoded);
  if (target.getItem(key) !== encoded) {
    throw new Error(`Failed to durably persist ${key}`);
  }
};

const parseJsonObject = (raw) => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

const intentStorageKey = (idempotencyKey) => (
  `${PENDING_RECORD_CREATE_V1_STORAGE_PREFIX}${idempotencyKey}`
);

const listIntentKeys = (storage) => {
  const target = requireStorage(storage);
  if (!Number.isSafeInteger(target.length) || target.length < 0 || typeof target.key !== 'function') {
    return [];
  }
  const keys = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (typeof key === 'string' && key.startsWith(PENDING_RECORD_CREATE_V1_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
};

const readBarrier = (storage, owner) => {
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const value = parseJsonObject(requireStorage(storage).getItem(RECORD_MUTATION_BARRIER_STORAGE_KEY));
  if (
    value?.version !== RECORD_CREATE_INTENT_VERSION
    || value.owner !== normalizedOwner
    || typeof value.token !== 'string'
    || !OPAQUE_ID_RE.test(value.token)
    || !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }
  return Object.freeze({ ...value });
};

const parseIntent = (raw, owner) => {
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const value = parseJsonObject(raw);
  if (
    value?.version !== RECORD_CREATE_INTENT_VERSION
    || value.owner !== normalizedOwner
    || typeof value.idempotencyKey !== 'string'
    || !OPAQUE_ID_RE.test(value.idempotencyKey)
    || typeof value.barrierToken !== 'string'
    || !OPAQUE_ID_RE.test(value.barrierToken)
    || !Number.isFinite(value.createdAt)
    || !Object.values(RECORD_CREATE_INTENT_STATE).includes(value.state)
  ) {
    return null;
  }

  if (value.state === RECORD_CREATE_INTENT_STATE.LIVE) {
    if (typeof value.body !== 'string' || !value.body) return null;
    if (
      value.reconcilingUntil !== undefined
      && !Number.isFinite(value.reconcilingUntil)
    ) {
      return null;
    }
  } else if (
    !Number.isFinite(value.terminalAt)
    || !(
      value.terminalReason === null
      || typeof value.terminalReason === 'string'
    )
  ) {
    return null;
  }

  return Object.freeze({ ...value });
};

export const rotateRecordMutationBarrier = (
  storage,
  owner,
  {
    now = Date.now(),
    createOpaqueId = defaultCreateOpaqueId,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const token = assertOpaqueId(createOpaqueId(), 'Record mutation barrier');
  const barrier = {
    version: RECORD_CREATE_INTENT_VERSION,
    owner: normalizedOwner,
    token,
    updatedAt: now,
  };
  verifiedSetJson(target, RECORD_MUTATION_BARRIER_STORAGE_KEY, barrier);
  return Object.freeze(barrier);
};

export const beginRecordCreateIntent = (
  storage,
  owner,
  payload,
  {
    now = Date.now(),
    createOpaqueId = defaultCreateOpaqueId,
    idempotencyKey = null,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const body = JSON.stringify(payload);
  if (typeof body !== 'string' || !body) {
    throw new Error('Record-create payload must be JSON serializable');
  }

  const [reconcilingIntent] = readEligibleRecordCreateIntents(target, normalizedOwner, {
    now,
    limit: 1,
  });
  if (
    reconcilingIntent?.body === body
    && Number.isFinite(reconcilingIntent.reconcilingUntil)
    && reconcilingIntent.reconcilingUntil > now
  ) {
    const error = new Error('相同的新增交易正在自動確認結果，請稍候再操作');
    error.name = 'RecordCreateReconciliationInProgressError';
    error.outcomeAmbiguous = false;
    throw error;
  }

  const markedKey = payload?.[RECORD_CREATE_IDEMPOTENCY_KEY] ?? null;
  if (idempotencyKey !== null && markedKey !== null && idempotencyKey !== markedKey) {
    throw new Error('Record-create idempotency metadata is inconsistent');
  }
  const requestedKey = idempotencyKey ?? markedKey;

  const barrier = rotateRecordMutationBarrier(target, normalizedOwner, { now, createOpaqueId });
  const resolvedIdempotencyKey = assertOpaqueId(
    requestedKey === null ? createOpaqueId() : requestedKey,
    'Record-create idempotency key',
  );
  const intent = {
    version: RECORD_CREATE_INTENT_VERSION,
    owner: normalizedOwner,
    idempotencyKey: resolvedIdempotencyKey,
    body,
    barrierToken: barrier.token,
    createdAt: now,
    state: RECORD_CREATE_INTENT_STATE.LIVE,
  };
  verifiedSetJson(target, intentStorageKey(resolvedIdempotencyKey), intent);

  const currentBarrier = readBarrier(target, normalizedOwner);
  if (!currentBarrier || currentBarrier.token !== barrier.token) {
    target.removeItem(intentStorageKey(resolvedIdempotencyKey));
    const error = new Error('Record-create intent was superseded before it could be sent');
    error.name = 'RecordCreateIntentSupersededError';
    error.outcomeAmbiguous = false;
    throw error;
  }

  return Object.freeze(intent);
};

export const markRecordCreateIntentReconciling = (
  storage,
  owner,
  idempotencyKey,
  {
    now = Date.now(),
    windowMs = RECORD_CREATE_RECONCILIATION_WINDOW_MS,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new TypeError('Record-create reconciliation window must be positive');
  }
  const key = intentStorageKey(assertOpaqueId(idempotencyKey, 'Record-create idempotency key'));
  const intent = parseIntent(target.getItem(key), normalizedOwner);
  const barrier = readBarrier(target, normalizedOwner);
  if (
    !intent
    || intent.state !== RECORD_CREATE_INTENT_STATE.LIVE
    || !barrier
    || intent.barrierToken !== barrier.token
  ) {
    return null;
  }

  const reconciling = {
    ...intent,
    reconcilingUntil: now + windowMs,
  };
  verifiedSetJson(target, key, reconciling);
  return Object.freeze(reconciling);
};

export const markRecordCreateIntentTerminal = (
  storage,
  owner,
  idempotencyKey,
  {
    now = Date.now(),
    reason = null,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const key = intentStorageKey(assertOpaqueId(idempotencyKey, 'Record-create idempotency key'));
  const intent = parseIntent(target.getItem(key), normalizedOwner);
  if (!intent) return false;

  const terminal = {
    version: intent.version,
    owner: intent.owner,
    idempotencyKey: intent.idempotencyKey,
    barrierToken: intent.barrierToken,
    createdAt: intent.createdAt,
    state: RECORD_CREATE_INTENT_STATE.TERMINAL,
    terminalAt: now,
    terminalReason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
  };

  try {
    verifiedSetJson(target, key, terminal);
  } catch (writeError) {
    try {
      target.removeItem(key);
      if (target.getItem(key) === null) return true;
    } catch {
      // Preserve the original persistence error. A storage surface that cannot be read/written
      // will also fail closed when recovery later tries to enumerate/read the intent.
    }
    throw writeError;
  }
  return true;
};

export const completeRecordCreateIntent = (storage, owner, idempotencyKey) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const key = intentStorageKey(assertOpaqueId(idempotencyKey, 'Record-create idempotency key'));
  if (!parseIntent(target.getItem(key), normalizedOwner)) return false;
  target.removeItem(key);
  return target.getItem(key) === null;
};

export const readEligibleRecordCreateIntents = (
  storage,
  owner,
  {
    now = Date.now(),
    ttlMs = RECORD_CREATE_INTENT_TTL_MS,
    limit = 1,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const barrier = readBarrier(target, normalizedOwner);
  if (!barrier || !Number.isFinite(ttlMs) || ttlMs <= 0 || !Number.isSafeInteger(limit) || limit <= 0) {
    return Object.freeze([]);
  }

  const eligible = [];
  for (const key of listIntentKeys(target)) {
    const intent = parseIntent(target.getItem(key), normalizedOwner);
    if (!intent || intent.state !== RECORD_CREATE_INTENT_STATE.LIVE) continue;
    if (intent.barrierToken !== barrier.token) continue;
    if (intent.createdAt > now + MAX_FUTURE_SKEW_MS) continue;
    if (now - intent.createdAt > ttlMs) continue;
    eligible.push(intent);
  }

  eligible.sort((left, right) => (
    right.createdAt - left.createdAt
    || right.idempotencyKey.localeCompare(left.idempotencyKey)
  ));
  return Object.freeze(eligible.slice(0, limit));
};
