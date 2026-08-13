export const TOKEN_STORAGE_KEY = 'token';
export const NAME_STORAGE_KEY = 'name';
export const EMAIL_STORAGE_KEY = 'email';
export const PENDING_CALCULATION_STORAGE_KEY = 'pending_calculation_request';
export const PENDING_CALCULATION_V2_STORAGE_PREFIX = 'pending_calculation_request.v2.';
export const PENDING_RECORD_CREATE_STORAGE_PREFIX = 'pending_record_create.v1.';
export const LEGACY_CACHED_RECORDS_STORAGE_KEY = 'cached_records';
export const CONFIRMED_DIVIDENDS_STORAGE_KEY = 'confirmed_dividend_keys';
export const USER_BENCHMARK_STORAGE_KEY = 'user_benchmark';

export const SENSITIVE_PROJECT_STORAGE_KEYS = Object.freeze([
  TOKEN_STORAGE_KEY,
  NAME_STORAGE_KEY,
  EMAIL_STORAGE_KEY,
  PENDING_CALCULATION_STORAGE_KEY,
  LEGACY_CACHED_RECORDS_STORAGE_KEY,
  CONFIRMED_DIVIDENDS_STORAGE_KEY,
  USER_BENCHMARK_STORAGE_KEY,
]);

export const SENSITIVE_PROJECT_STORAGE_PREFIXES = Object.freeze([
  PENDING_CALCULATION_V2_STORAGE_PREFIX,
  PENDING_RECORD_CREATE_STORAGE_PREFIX,
]);

function requireStorage(storage) {
  if (!storage || typeof storage.removeItem !== 'function') {
    throw new TypeError('A Storage-compatible object is required');
  }
  return storage;
}

function listSensitiveDynamicKeys(storage) {
  if (!Number.isSafeInteger(storage.length) || storage.length < 0 || typeof storage.key !== 'function') {
    return [];
  }

  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      typeof key === 'string'
      && SENSITIVE_PROJECT_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))
    ) {
      keys.push(key);
    }
  }
  return keys;
}

function normalizeRecordCreateOwner(owner) {
  const normalized = String(owner || '').trim().toLowerCase();
  if (!normalized) throw new TypeError('Authenticated record-create owner is required');
  return normalized;
}

function createRecordCreateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random id generation is unavailable');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

function cloneRecordCreatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Record-create payload must be an object');
  }
  const serialized = JSON.stringify(payload);
  if (!serialized) throw new TypeError('Record-create payload must be JSON serializable');
  return JSON.parse(serialized);
}

function recordCreateIntentStorageKey(owner, key) {
  return `${PENDING_RECORD_CREATE_STORAGE_PREFIX}${encodeURIComponent(normalizeRecordCreateOwner(owner))}.${encodeURIComponent(key)}`;
}

export function createRecordCreateIntent(storage, owner, payload, options = {}) {
  const target = requireStorage(storage);
  if (typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('Record-create intent requires readable/writable storage');
  }
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const createId = typeof options.createId === 'function' ? options.createId : createRecordCreateId;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const key = String(createId()).trim();
  if (!key) throw new Error('Record-create intent identity generation failed');
  const intent = Object.freeze({
    version: 1,
    key,
    owner: normalizedOwner,
    payload: Object.freeze(cloneRecordCreatePayload(payload)),
    createdAt: Number(now()),
  });
  const storageKey = recordCreateIntentStorageKey(normalizedOwner, key);
  const serialized = JSON.stringify(intent);

  try {
    target.setItem(storageKey, serialized);
    if (target.getItem(storageKey) !== serialized) {
      throw new Error('Record-create intent persistence verification mismatch');
    }
  } catch (error) {
    const wrapped = new Error('Unable to durably persist record-create intent');
    wrapped.name = 'RecordCreateIntentStorageError';
    wrapped.cause = error;
    throw wrapped;
  }

  return intent;
}

export function readRecordCreateIntents(storage, owner) {
  const target = requireStorage(storage);
  if (typeof target.getItem !== 'function' || !Number.isSafeInteger(target.length) || typeof target.key !== 'function') {
    throw new TypeError('Record-create recovery requires enumerable readable storage');
  }
  const normalizedOwner = normalizeRecordCreateOwner(owner);
  const prefix = `${PENDING_RECORD_CREATE_STORAGE_PREFIX}${encodeURIComponent(normalizedOwner)}.`;
  const intents = [];

  for (let index = 0; index < target.length; index += 1) {
    const storageKey = target.key(index);
    if (typeof storageKey !== 'string' || !storageKey.startsWith(prefix)) continue;
    const raw = target.getItem(storageKey);
    if (raw === null) continue;
    const intent = JSON.parse(raw);
    if (
      intent?.version !== 1
      || normalizeRecordCreateOwner(intent.owner) !== normalizedOwner
      || typeof intent.key !== 'string'
      || !intent.key
      || !intent.payload
    ) {
      throw new Error(`Stored record-create intent is malformed: ${storageKey}`);
    }
    intents.push(intent);
  }

  return intents.sort((left, right) => left.createdAt - right.createdAt || left.key.localeCompare(right.key));
}

export function clearRecordCreateIntent(storage, intent) {
  requireStorage(storage).removeItem(recordCreateIntentStorageKey(intent.owner, intent.key));
}

export function clearLegacyRecordCache(storage) {
  requireStorage(storage).removeItem(LEGACY_CACHED_RECORDS_STORAGE_KEY);
}

export function clearSensitiveProjectStorage(storage) {
  const target = requireStorage(storage);
  const failures = [];
  const removed = [];
  let dynamicKeys = [];

  try {
    dynamicKeys = listSensitiveDynamicKeys(target);
  } catch (error) {
    failures.push({ key: 'dynamic-sensitive-prefixes', error });
  }

  const keysToRemove = [...new Set([...SENSITIVE_PROJECT_STORAGE_KEYS, ...dynamicKeys])];
  for (const key of keysToRemove) {
    try {
      target.removeItem(key);
      removed.push(key);
    } catch (error) {
      failures.push({ key, error });
    }
  }

  if (failures.length > 0) {
    const failure = new Error(`Failed to clear ${failures.length} project storage key(s)`);
    failure.name = 'ProjectStorageCleanupError';
    failure.failures = failures;
    throw failure;
  }

  return removed;
}