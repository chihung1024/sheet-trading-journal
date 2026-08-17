import { PENDING_JOURNAL_RESTORE_V1_STORAGE_PREFIX } from './projectStorage.js';
import { validateJournalRestoreBackup } from './journalRestorePreview.js';

export const JOURNAL_RESTORE_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
const OPAQUE_ID_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const textEncoder = new TextEncoder();

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

const normalizeOwner = (owner) => {
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('Signed restore owner is required');
  return owner.trim().toLowerCase();
};

const keyForOwner = (owner) => (
  `${PENDING_JOURNAL_RESTORE_V1_STORAGE_PREFIX}${encodeURIComponent(normalizeOwner(owner))}`
);

const secureOpaqueId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random ID generation is unavailable');
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

const requireCryptoSubtle = (cryptoImpl) => {
  if (!cryptoImpl?.subtle?.digest) throw new Error('Secure restore fingerprinting is unavailable');
  return cryptoImpl.subtle;
};

const persistVerified = (storage, key, value) => {
  const encoded = JSON.stringify(value);
  storage.setItem(key, encoded);
  if (storage.getItem(key) !== encoded) throw new Error('Restore intent could not be durably persisted');
};

const parseStoredIntent = (storage, owner) => {
  const key = keyForOwner(owner);
  let value;
  try {
    value = JSON.parse(storage.getItem(key) || 'null');
  } catch {
    value = null;
  }
  return { key, value };
};

export const fingerprintJournalRestoreBackup = async (
  backup,
  { cryptoImpl = globalThis.crypto } = {},
) => {
  const normalized = validateJournalRestoreBackup(backup);
  const material = `journal-restore-browser-intent-v1\n${JSON.stringify(normalized)}`;
  const digest = await requireCryptoSubtle(cryptoImpl).digest('SHA-256', textEncoder.encode(material));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const readJournalRestoreIntent = (
  storage,
  owner,
  { now = Date.now(), ttlMs = JOURNAL_RESTORE_INTENT_TTL_MS } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  const { key, value } = parseStoredIntent(target, normalizedOwner);
  const valid = (
    value
    && value.version === 1
    && value.owner === normalizedOwner
    && OPAQUE_ID_RE.test(value.idempotencyKey || '')
    && HASH_RE.test(value.fingerprint || '')
    && Number.isFinite(value.createdAt)
  );

  if (!valid) {
    if (value !== null) target.removeItem(key);
    return null;
  }
  if (value.createdAt > now + 5 * 60 * 1000 || now - value.createdAt > ttlMs) {
    target.removeItem(key);
    return null;
  }
  return Object.freeze({ ...value });
};

export const beginJournalRestoreIntent = async (
  storage,
  owner,
  backup,
  {
    now = Date.now(),
    createOpaqueId = secureOpaqueId,
    cryptoImpl = globalThis.crypto,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  const fingerprint = await fingerprintJournalRestoreBackup(backup, { cryptoImpl });
  const existing = readJournalRestoreIntent(target, normalizedOwner, { now });
  if (existing?.fingerprint === fingerprint) return existing;

  const idempotencyKey = createOpaqueId();
  if (typeof idempotencyKey !== 'string' || !OPAQUE_ID_RE.test(idempotencyKey)) {
    throw new Error('Restore idempotency key is invalid');
  }

  const value = Object.freeze({
    version: 1,
    owner: normalizedOwner,
    idempotencyKey,
    fingerprint,
    createdAt: now,
  });
  persistVerified(target, keyForOwner(normalizedOwner), value);
  return value;
};

export const completeJournalRestoreIntent = (storage, owner, idempotencyKey) => {
  const target = requireStorage(storage);
  const current = readJournalRestoreIntent(target, owner);
  if (!current || current.idempotencyKey !== idempotencyKey) return false;
  const key = keyForOwner(owner);
  target.removeItem(key);
  return target.getItem(key) === null;
};

export const completeJournalRestoreIntentForBackup = async (
  storage,
  owner,
  backup,
  { cryptoImpl = globalThis.crypto } = {},
) => {
  const current = readJournalRestoreIntent(storage, owner);
  if (!current) return false;
  const fingerprint = await fingerprintJournalRestoreBackup(backup, { cryptoImpl });
  if (current.fingerprint !== fingerprint) return false;
  return completeJournalRestoreIntent(storage, owner, current.idempotencyKey);
};
