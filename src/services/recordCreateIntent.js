import {
  PENDING_RECORD_CREATE_V1_STORAGE_PREFIX,
  RECORD_MUTATION_BARRIER_STORAGE_KEY,
} from './projectStorage.js';

export const RECORD_CREATE_INTENT_VERSION = 1;
export const RECORD_CREATE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
export const RECORD_CREATE_INTENT_STATE = Object.freeze({
  LIVE: 'live',
  TERMINAL: 'terminal',
});

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const OPAQUE_ID_RE = /^[A-Za-z0-9._-]{16,128}$/;

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
    || typeof value.body !== 'string'
    || !value.body
    || typeof value.barrierToken !== 'string'
    || !OPAQUE_ID_RE.test(value.barrierToken)
    || !Number.isFinite(value.createdAt)
    || !Object.values(RECORD_CREATE_INTENT_STATE).includes(value.state)
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
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const body = JSON.stringify(payload);
  if (typeof body !== 'string' || !body) {
    throw new Error('Record-create payload must be JSON serializable');
  }

  const barrier = rotateRecordMutationBarrier(target, normalizedOwner, { now, createOpaqueId });
  const idempotencyKey = assertOpaqueId(createOpaqueId(), 'Record-create idempotency key');
  const intent = {
    version: RECORD_CREATE_INTENT_VERSION,
    owner: normalizedOwner,
    idempotencyKey,
    body,
    barrierToken: barrier.token,
    createdAt: now,
    state: RECORD_CREATE_INTENT_STATE.LIVE,
  };
  verifiedSetJson(target, intentStorageKey(idempotencyKey), intent);

  const currentBarrier = readBarrier(target, normalizedOwner);
  if (!currentBarrier || currentBarrier.token !== barrier.token) {
    target.removeItem(intentStorageKey(idempotencyKey));
    const error = new Error('Record-create intent was superseded before it could be sent');
    error.name = 'RecordCreateIntentSupersededError';
    error.outcomeAmbiguous = false;
    throw error;
  }

  return Object.freeze(intent);
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
    ...intent,
    state: RECORD_CREATE_INTENT_STATE.TERMINAL,
    terminalAt: now,
    terminalReason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
  };
  verifiedSetJson(target, key, terminal);
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
