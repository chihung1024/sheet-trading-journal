export const TOKEN_STORAGE_KEY = 'token';
export const NAME_STORAGE_KEY = 'name';
export const EMAIL_STORAGE_KEY = 'email';
export const PENDING_CALCULATION_STORAGE_KEY = 'pending_calculation_request';
export const PENDING_CALCULATION_V2_STORAGE_PREFIX = 'pending_calculation_request.v2.';
export const PENDING_RECORD_CREATE_V1_STORAGE_PREFIX = 'pending_record_create.v1.';
export const RECORD_MUTATION_BARRIER_STORAGE_KEY = 'record_mutation_barrier.v1';
export const AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY = 'automatic_recalculation_dirty.v1';
export const AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY = 'automatic_recalculation_clean.v1';
export const AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX = 'automatic_recalculation_coverage.v1.';
export const LEGACY_CACHED_RECORDS_STORAGE_KEY = 'cached_records';
export const CONFIRMED_DIVIDENDS_STORAGE_KEY = 'confirmed_dividend_keys';
export const USER_BENCHMARK_STORAGE_KEY = 'user_benchmark';

export const SENSITIVE_PROJECT_STORAGE_KEYS = Object.freeze([
  TOKEN_STORAGE_KEY,
  NAME_STORAGE_KEY,
  EMAIL_STORAGE_KEY,
  PENDING_CALCULATION_STORAGE_KEY,
  RECORD_MUTATION_BARRIER_STORAGE_KEY,
  AUTOMATIC_RECALCULATION_DIRTY_STORAGE_KEY,
  AUTOMATIC_RECALCULATION_CLEAN_STORAGE_KEY,
  LEGACY_CACHED_RECORDS_STORAGE_KEY,
  CONFIRMED_DIVIDENDS_STORAGE_KEY,
  USER_BENCHMARK_STORAGE_KEY,
]);

export const SENSITIVE_PROJECT_STORAGE_PREFIXES = Object.freeze([
  PENDING_CALCULATION_V2_STORAGE_PREFIX,
  PENDING_RECORD_CREATE_V1_STORAGE_PREFIX,
  AUTOMATIC_RECALCULATION_COVERAGE_V1_STORAGE_PREFIX,
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
    failures.push({ key: 'sensitive-dynamic-prefixes', error });
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
