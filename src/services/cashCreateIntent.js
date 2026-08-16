import { PENDING_CASH_CREATE_V1_STORAGE_PREFIX } from './projectStorage.js';
import { normalizeCashEventState } from './cashEventApi.js';

export const CASH_CREATE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
const OPAQUE_ID_RE = /^[A-Za-z0-9._-]{16,128}$/;

const requireStorage = (storage) => {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('A readable/writable Storage-compatible object is required');
  }
  return storage;
};

const normalizeOwner = (owner) => {
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('Signed cash-event owner is required');
  return owner.trim().toLowerCase();
};

const keyForOwner = (owner) => `${PENDING_CASH_CREATE_V1_STORAGE_PREFIX}${encodeURIComponent(normalizeOwner(owner))}`;

const secureOpaqueId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random ID generation is unavailable');
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

const persistVerified = (storage, key, value) => {
  const encoded = JSON.stringify(value);
  storage.setItem(key, encoded);
  if (storage.getItem(key) !== encoded) throw new Error('Cash create intent could not be durably persisted');
};

export const readCashCreateIntent = (storage, owner, { now = Date.now(), ttlMs = CASH_CREATE_INTENT_TTL_MS } = {}) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  let value;
  try { value = JSON.parse(target.getItem(keyForOwner(normalizedOwner)) || 'null'); } catch { value = null; }
  if (!value || value.version !== 1 || value.owner !== normalizedOwner || !OPAQUE_ID_RE.test(value.idempotencyKey || '') || !Number.isFinite(value.createdAt)) return null;
  if (value.createdAt > now + 5 * 60 * 1000 || now - value.createdAt > ttlMs) {
    target.removeItem(keyForOwner(normalizedOwner));
    return null;
  }
  try {
    const event = normalizeCashEventState(JSON.parse(value.body));
    return Object.freeze({ ...value, event });
  } catch {
    return null;
  }
};

export const beginCashCreateIntent = (storage, owner, event, { now = Date.now(), createOpaqueId = secureOpaqueId } = {}) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  const normalizedEvent = normalizeCashEventState(event);
  const body = JSON.stringify(normalizedEvent);
  const existing = readCashCreateIntent(target, normalizedOwner, { now });
  if (existing) {
    if (existing.body === body) return existing;
    const error = new Error('上一筆現金新增結果尚未確認，請先按「確認上一筆結果」再建立新的現金紀錄');
    error.name = 'CashCreatePendingIntentError';
    error.outcomeAmbiguous = false;
    throw error;
  }
  const idempotencyKey = createOpaqueId();
  if (typeof idempotencyKey !== 'string' || !OPAQUE_ID_RE.test(idempotencyKey)) throw new Error('Cash create idempotency key is invalid');
  const value = { version: 1, owner: normalizedOwner, idempotencyKey, body, createdAt: now };
  persistVerified(target, keyForOwner(normalizedOwner), value);
  return Object.freeze({ ...value, event: normalizedEvent });
};

export const completeCashCreateIntent = (storage, owner, idempotencyKey) => {
  const target = requireStorage(storage);
  const current = readCashCreateIntent(target, owner);
  if (!current || current.idempotencyKey !== idempotencyKey) return false;
  const key = keyForOwner(owner);
  target.removeItem(key);
  return target.getItem(key) === null;
};
