import {
  AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY,
  AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX,
  AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY,
} from './projectStorage.js';

export const AUTOMATIC_RECALCULATION_STATE_VERSION = 1;

const MAX_FUTURE_SKEW_MS = 60_000;
const TOKEN_RE = /^[A-Za-z0-9._-]{16,128}$/;
const JOB_ID_RE = /^job_[A-Za-z0-9_-]{22}$/;

const normalizeOwner = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const normalizeBenchmark = (value) => (
  typeof value === 'string' ? value.trim().toUpperCase() : ''
);

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

const createOpaqueToken = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is unavailable');
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

const parseObject = (raw) => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

const verifiedWrite = (storage, key, value) => {
  const encoded = JSON.stringify(value);
  storage.setItem(key, encoded);
  if (storage.getItem(key) !== encoded) {
    throw new Error(`Failed to durably persist ${key}`);
  }
};

const validateGeneration = (value, owner, { now = Date.now() } = {}) => {
  const expectedOwner = normalizeOwner(owner);
  const benchmark = normalizeBenchmark(value?.benchmark);
  if (
    value?.version !== AUTOMATIC_RECALCULATION_STATE_VERSION
    || !expectedOwner
    || normalizeOwner(value.owner) !== expectedOwner
    || typeof value.token !== 'string'
    || !TOKEN_RE.test(value.token)
    || !Number.isFinite(value.createdAt)
    || value.createdAt <= 0
    || value.createdAt > now + MAX_FUTURE_SKEW_MS
    || !benchmark
    || benchmark.length > 64
  ) {
    return null;
  }
  return Object.freeze({
    version: AUTOMATIC_RECALCULATION_STATE_VERSION,
    owner: expectedOwner,
    token: value.token,
    createdAt: value.createdAt,
    benchmark,
  });
};

const validateClean = (value, owner, options = {}) => {
  const generation = validateGeneration(value, owner, options);
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  if (
    !generation
    || typeof value.jobId !== 'string'
    || !JOB_ID_RE.test(value.jobId)
    || !Number.isFinite(value.completedAt)
    || value.completedAt < generation.createdAt
    || value.completedAt > now + MAX_FUTURE_SKEW_MS
  ) {
    return null;
  }
  return Object.freeze({
    ...generation,
    jobId: value.jobId,
    completedAt: value.completedAt,
  });
};

const coverageStorageKey = jobId => (
  `${AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX}${jobId}`
);

const validateCoverage = (value, owner, jobId, { now = Date.now() } = {}) => {
  const generation = validateGeneration({
    version: value?.version,
    owner: value?.owner,
    token: value?.token,
    createdAt: value?.dirtyAt,
    benchmark: value?.benchmark,
  }, owner, { now });
  if (
    !generation
    || typeof value.jobId !== 'string'
    || value.jobId !== jobId
    || !JOB_ID_RE.test(value.jobId)
    || !Number.isFinite(value.coveredAt)
    || value.coveredAt < generation.createdAt
    || value.coveredAt > now + MAX_FUTURE_SKEW_MS
  ) {
    return null;
  }
  return Object.freeze({
    version: AUTOMATIC_RECALCULATION_STATE_VERSION,
    owner: generation.owner,
    token: generation.token,
    dirtyAt: generation.createdAt,
    benchmark: generation.benchmark,
    jobId: value.jobId,
    coveredAt: value.coveredAt,
  });
};

const readGenerationKey = (storage, key, owner, options = {}) => (
  validateGeneration(parseObject(storage.getItem(key)), owner, options)
);

const readClean = (storage, owner, options = {}) => (
  validateClean(parseObject(storage.getItem(AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY)), owner, options)
);

export const readAutomaticRecalculationStatus = (storage, owner, options = {}) => {
  const target = requireStorage(storage);
  const dirtyGeneration = readGenerationKey(
    target,
    AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY,
    owner,
    options,
  );
  const cleanGeneration = readClean(target, owner, options);
  const dirty = Boolean(
    dirtyGeneration
    && (!cleanGeneration || cleanGeneration.token !== dirtyGeneration.token)
  );
  return Object.freeze({
    dirty,
    generation: dirty ? dirtyGeneration : null,
    clean: cleanGeneration,
  });
};

export const markAutomaticRecalculationDirty = (
  storage,
  owner,
  benchmark,
  {
    now = Date.now(),
    createToken = createOpaqueToken,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  const normalizedBenchmark = normalizeBenchmark(benchmark);
  const token = createToken();
  if (
    !normalizedOwner
    || !normalizedBenchmark
    || normalizedBenchmark.length > 64
    || typeof token !== 'string'
    || !TOKEN_RE.test(token)
  ) {
    throw new Error('Automatic recalculation generation is invalid');
  }

  const generation = {
    version: AUTOMATIC_RECALCULATION_STATE_VERSION,
    owner: normalizedOwner,
    token,
    createdAt: now,
    benchmark: normalizedBenchmark,
  };
  verifiedWrite(target, AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY, generation);
  return validateGeneration(generation, normalizedOwner, { now });
};

export const markAutomaticRecalculationCoverage = (
  storage,
  owner,
  generation,
  job,
  {
    now = Date.now(),
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  const validatedGeneration = validateGeneration(generation, normalizedOwner, { now });
  const jobBenchmark = normalizeBenchmark(job?.benchmark);
  if (
    !validatedGeneration
    || job?.deduplicated === true
    || typeof job?.id !== 'string'
    || !JOB_ID_RE.test(job.id)
    || (jobBenchmark && jobBenchmark !== validatedGeneration.benchmark)
  ) {
    return false;
  }

  const coverage = {
    version: AUTOMATIC_RECALCULATION_STATE_VERSION,
    owner: normalizedOwner,
    token: validatedGeneration.token,
    dirtyAt: validatedGeneration.createdAt,
    benchmark: validatedGeneration.benchmark,
    jobId: job.id,
    coveredAt: now,
  };
  verifiedWrite(target, coverageStorageKey(job.id), coverage);
  return true;
};

export const settleAutomaticRecalculationJob = (
  storage,
  owner,
  jobId,
  {
    succeeded,
    now = Date.now(),
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  if (!normalizedOwner || typeof jobId !== 'string' || !JOB_ID_RE.test(jobId)) {
    return readAutomaticRecalculationStatus(target, normalizedOwner || owner, { now });
  }

  const key = coverageStorageKey(jobId);
  const coverage = validateCoverage(parseObject(target.getItem(key)), normalizedOwner, jobId, { now });
  if (coverage && succeeded === true) {
    const existingClean = readClean(target, normalizedOwner, { now });
    if (!existingClean || existingClean.createdAt <= coverage.dirtyAt) {
      const clean = {
        version: AUTOMATIC_RECALCULATION_STATE_VERSION,
        owner: normalizedOwner,
        token: coverage.token,
        createdAt: coverage.dirtyAt,
        benchmark: coverage.benchmark,
        jobId,
        completedAt: now,
      };
      verifiedWrite(target, AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY, clean);
    }
  }

  if (coverage) {
    try {
      target.removeItem(key);
    } catch {
      // Stale coverage is harmless: a later settlement can only re-assert the
      // same covered token and can never overwrite the current dirty generation.
    }
  }

  return readAutomaticRecalculationStatus(target, normalizedOwner, { now });
};

const listCoverageKeys = (storage) => {
  if (!Number.isSafeInteger(storage.length) || storage.length < 0 || typeof storage.key !== 'function') {
    return [];
  }
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
};

export const clearAutomaticRecalculationState = (storage, owner) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  if (!normalizedOwner) return 0;
  let removed = 0;

  for (const key of [
    AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY,
    AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY,
  ]) {
    const value = parseObject(target.getItem(key));
    if (normalizeOwner(value?.owner) !== normalizedOwner) continue;
    target.removeItem(key);
    removed += 1;
  }

  for (const key of listCoverageKeys(target)) {
    const value = parseObject(target.getItem(key));
    if (normalizeOwner(value?.owner) !== normalizedOwner) continue;
    target.removeItem(key);
    removed += 1;
  }
  return removed;
};
