import { PENDING_CALCULATION_V2_STORAGE_PREFIX } from './projectStorage.js';

export const CALCULATION_REQUEST_STORAGE_KEY = 'pending_calculation_request';
export const CALCULATION_REQUEST_TTL_MS = 15 * 60 * 1000;
export const CALCULATION_REQUEST_V2_VERSION = 2;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const JOB_ID_RE = /^job_[A-Za-z0-9_-]{22}$/;

export function normalizeCalculationOwner(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validatePendingCalculationRequest(value, owner, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : CALCULATION_REQUEST_TTL_MS;
  const expectedOwner = normalizeCalculationOwner(owner);

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!expectedOwner || normalizeCalculationOwner(value.owner) !== expectedOwner) return null;
  if (typeof value.key !== 'string' || !IDEMPOTENCY_KEY_RE.test(value.key)) return null;
  if (!Number.isFinite(value.createdAt) || value.createdAt <= 0 || value.createdAt > now + 60_000) return null;
  if (now - value.createdAt >= ttlMs) return null;
  if (value.jobId !== null && (typeof value.jobId !== 'string' || !JOB_ID_RE.test(value.jobId))) return null;

  return {
    owner: expectedOwner,
    key: value.key,
    createdAt: value.createdAt,
    jobId: value.jobId,
  };
}

const generationStorageKey = ({ createdAt, key }) => (
  `${PENDING_CALCULATION_V2_STORAGE_PREFIX}${createdAt}.${key}`
);

export function getPendingCalculationGenerationStorageKey(pending) {
  if (
    !pending
    || !Number.isFinite(pending.createdAt)
    || pending.createdAt <= 0
    || typeof pending.key !== 'string'
    || !IDEMPOTENCY_KEY_RE.test(pending.key)
  ) {
    throw new TypeError('Pending calculation generation is invalid');
  }
  return generationStorageKey(pending);
}

function validateGenerationRecord(value, owner, storageKey, options = {}) {
  if (value?.version !== CALCULATION_REQUEST_V2_VERSION) return null;
  const base = validatePendingCalculationRequest(value, owner, options);
  if (!base || generationStorageKey(base) !== storageKey) return null;

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const clearedAt = value.clearedAt ?? null;
  if (
    clearedAt !== null
    && (
      !Number.isFinite(clearedAt)
      || clearedAt < base.createdAt
      || clearedAt > now + 60_000
    )
  ) {
    return null;
  }

  return {
    version: CALCULATION_REQUEST_V2_VERSION,
    ...base,
    clearedAt,
  };
}

function listGenerationKeys(storage) {
  if (!Number.isSafeInteger(storage?.length) || storage.length < 0 || typeof storage?.key !== 'function') {
    return null;
  }
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(PENDING_CALCULATION_V2_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

function readGenerationRecords(storage, owner, options = {}) {
  const keys = listGenerationKeys(storage);
  if (keys === null) return { enumerable: false, records: [] };

  const records = [];
  for (const storageKey of keys) {
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) || 'null');
      const record = validateGenerationRecord(parsed, owner, storageKey, options);
      if (record) records.push({ storageKey, record });
    } catch {
      // A malformed generation is ignored. Its immutable key cannot clobber
      // another generation, and valid candidates remain independently readable.
    }
  }
  return { enumerable: true, records };
}

function readLegacyPending(storage, owner, options = {}) {
  try {
    const parsed = JSON.parse(storage.getItem(CALCULATION_REQUEST_STORAGE_KEY) || 'null');
    return validatePendingCalculationRequest(parsed, owner, options);
  } catch {
    return null;
  }
}

const newestByCreatedAt = records => records.reduce(
  (latest, item) => (!latest || item.record.createdAt > latest.record.createdAt ? item : latest),
  null,
);

export function readPendingCalculationRequest(storage, owner, options = {}) {
  if (!storage || typeof storage.getItem !== 'function') return null;

  let generations;
  try {
    generations = readGenerationRecords(storage, owner, options);
  } catch {
    return null;
  }

  if (!generations.enumerable) {
    return readLegacyPending(storage, owner, options);
  }

  const tombstones = generations.records.filter(item => item.record.clearedAt !== null);
  const newestTombstone = newestByCreatedAt(tombstones);
  const watermark = newestTombstone?.record.createdAt ?? -Infinity;
  const live = generations.records.filter(
    item => item.record.clearedAt === null && item.record.createdAt > watermark,
  );
  const newestLive = newestByCreatedAt(live);
  if (newestLive) {
    const { version: _version, clearedAt: _clearedAt, ...pending } = newestLive.record;
    return pending;
  }

  const legacy = readLegacyPending(storage, owner, options);
  if (!legacy || legacy.createdAt <= watermark) return null;

  const sameKeyGeneration = generations.records.find(item => item.record.key === legacy.key);
  if (sameKeyGeneration) return null;
  return legacy;
}

function findNewestGenerationForKey(generations, key) {
  return newestByCreatedAt(generations.records.filter(item => item.record.key === key));
}

function bestEffortMirrorLegacy(storage, pending) {
  try {
    storage.setItem(CALCULATION_REQUEST_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // V2 is authoritative for the current application. The fixed key is only a
    // compatibility mirror for already-open legacy tabs.
  }
}

export function rememberPendingCalculationRequest(storage, owner, pending) {
  if (!storage || typeof storage.setItem !== 'function' || typeof storage.getItem !== 'function') {
    throw new Error('Calculation job storage is unavailable');
  }

  const normalizedOwner = normalizeCalculationOwner(owner);
  if (!normalizedOwner || typeof pending?.key !== 'string' || !IDEMPOTENCY_KEY_RE.test(pending.key)) {
    throw new Error('Pending calculation request is invalid');
  }

  const proposed = validatePendingCalculationRequest(
    { ...pending, owner: normalizedOwner },
    normalizedOwner,
    { now: pending.createdAt },
  );
  if (!proposed) throw new Error('Pending calculation request is invalid');

  let generations;
  try {
    generations = readGenerationRecords(storage, normalizedOwner, { now: proposed.createdAt });
  } catch {
    throw new Error('Calculation job storage is unavailable');
  }

  const existing = generations.enumerable
    ? findNewestGenerationForKey(generations, proposed.key)
    : null;
  if (existing?.record.clearedAt !== null) {
    throw new Error('Pending calculation generation is already cleared');
  }

  const legacy = readLegacyPending(storage, normalizedOwner, { now: proposed.createdAt });
  const stableCreatedAt = existing?.record.createdAt
    ?? (legacy?.key === proposed.key ? legacy.createdAt : proposed.createdAt);
  const stableJobId = proposed.jobId ?? existing?.record.jobId ?? null;
  const stable = validatePendingCalculationRequest(
    {
      owner: normalizedOwner,
      key: proposed.key,
      createdAt: stableCreatedAt,
      jobId: stableJobId,
    },
    normalizedOwner,
    { now: proposed.createdAt },
  );
  if (!stable) throw new Error('Pending calculation request is invalid');

  const generation = {
    version: CALCULATION_REQUEST_V2_VERSION,
    ...stable,
    clearedAt: null,
  };
  storage.setItem(generationStorageKey(stable), JSON.stringify(generation));
  bestEffortMirrorLegacy(storage, stable);
  return stable;
}

const selectorMatches = (record, selector) => (
  (typeof selector?.key === 'string' && record.key === selector.key)
  || (typeof selector?.jobId === 'string' && record.jobId === selector.jobId)
);

export function clearPendingCalculationRequest(storage, owner, selector, options = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return 0;
  const normalizedOwner = normalizeCalculationOwner(owner);
  if (!normalizedOwner) return 0;

  const hasKey = typeof selector?.key === 'string' && IDEMPOTENCY_KEY_RE.test(selector.key);
  const hasJobId = typeof selector?.jobId === 'string' && JOB_ID_RE.test(selector.jobId);
  if (!hasKey && !hasJobId) return 0;

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  let generations;
  try {
    generations = readGenerationRecords(storage, normalizedOwner, { now });
  } catch {
    return 0;
  }

  const matches = generations.enumerable
    ? generations.records.filter(
      item => item.record.clearedAt === null && selectorMatches(item.record, selector),
    )
    : [];

  if (matches.length === 0) {
    const legacy = readLegacyPending(storage, normalizedOwner, { now });
    if (legacy && selectorMatches(legacy, selector)) {
      matches.push({
        storageKey: generationStorageKey(legacy),
        record: {
          version: CALCULATION_REQUEST_V2_VERSION,
          ...legacy,
          clearedAt: null,
        },
      });
    }
  }

  let cleared = 0;
  for (const match of matches) {
    const tombstone = {
      ...match.record,
      clearedAt: Math.max(now, match.record.createdAt),
    };
    try {
      storage.setItem(match.storageKey, JSON.stringify(tombstone));
      cleared += 1;
    } catch {
      // Do not fall back to deleting the shared legacy pointer; that would
      // reintroduce the cross-generation clobber race this format prevents.
    }
  }
  return cleared;
}

export function isTerminalCalculationStatus(status) {
  return status === 'succeeded' || status === 'failed';
}
