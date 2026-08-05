export const CALCULATION_REQUEST_STORAGE_KEY = 'pending_calculation_request';
export const CALCULATION_REQUEST_TTL_MS = 15 * 60 * 1000;

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

export function readPendingCalculationRequest(storage, owner, options = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.removeItem !== 'function') return null;
  try {
    const parsed = JSON.parse(storage.getItem(CALCULATION_REQUEST_STORAGE_KEY) || 'null');
    const validated = validatePendingCalculationRequest(parsed, owner, options);
    if (!validated) storage.removeItem(CALCULATION_REQUEST_STORAGE_KEY);
    return validated;
  } catch {
    storage.removeItem(CALCULATION_REQUEST_STORAGE_KEY);
    return null;
  }
}

export function rememberPendingCalculationRequest(storage, owner, pending) {
  if (!storage || typeof storage.setItem !== 'function') throw new Error('Calculation job storage is unavailable');
  const normalizedOwner = normalizeCalculationOwner(owner);
  const validated = validatePendingCalculationRequest(
    { ...pending, owner: normalizedOwner },
    normalizedOwner,
    { now: pending.createdAt },
  );
  if (!validated) throw new Error('Pending calculation request is invalid');
  storage.setItem(CALCULATION_REQUEST_STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export function clearPendingCalculationRequest(storage) {
  if (storage && typeof storage.removeItem === 'function') {
    storage.removeItem(CALCULATION_REQUEST_STORAGE_KEY);
  }
}

export function isTerminalCalculationStatus(status) {
  return status === 'succeeded' || status === 'failed';
}
