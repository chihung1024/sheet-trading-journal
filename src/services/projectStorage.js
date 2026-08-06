export const TOKEN_STORAGE_KEY = 'token';
export const NAME_STORAGE_KEY = 'name';
export const EMAIL_STORAGE_KEY = 'email';
export const PENDING_CALCULATION_STORAGE_KEY = 'pending_calculation_request';
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

function requireStorage(storage) {
  if (!storage || typeof storage.removeItem !== 'function') {
    throw new TypeError('A Storage-compatible object is required');
  }
  return storage;
}

export function clearLegacyRecordCache(storage) {
  requireStorage(storage).removeItem(LEGACY_CACHED_RECORDS_STORAGE_KEY);
}

export function clearSensitiveProjectStorage(storage) {
  const target = requireStorage(storage);
  const failures = [];
  const removed = [];

  for (const key of SENSITIVE_PROJECT_STORAGE_KEYS) {
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
