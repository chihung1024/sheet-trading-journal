import { deriveMarketRefreshScopeKey } from './marketRefreshLeadership.js';

export const CALCULATION_JOB_POLL_CLAIM_STORAGE_PREFIX = 'sheet_trading_journal.calculation_poll_claim.';
export const CALCULATION_JOB_POLL_CLAIM_VERSION = 1;
export const CALCULATION_JOB_POLL_CLAIM_SETTLE_MS = 75;

const JOB_ID_RE = /^job_[A-Za-z0-9_-]{22}$/;

const createDefaultRandomId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Secure random identifier source is unavailable');
};

const defaultDelay = milliseconds => new Promise(resolve => {
  globalThis.setTimeout(resolve, milliseconds);
});

const validTimestamp = value => Number.isSafeInteger(value) && value >= 0;

const validateClaimRecord = (value, jobId) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.version !== CALCULATION_JOB_POLL_CLAIM_VERSION) return null;
  if (value.jobId !== jobId) return null;
  if (typeof value.claimId !== 'string' || !value.claimId) return null;
  if (!validTimestamp(value.claimedAt) || !validTimestamp(value.nextAllowedAt)) return null;
  if (value.nextAllowedAt < value.claimedAt) return null;
  return {
    version: CALCULATION_JOB_POLL_CLAIM_VERSION,
    jobId,
    claimId: value.claimId,
    claimedAt: value.claimedAt,
    nextAllowedAt: value.nextAllowedAt,
  };
};

const parseClaimRecord = (raw, jobId) => {
  if (raw === null) return null;
  try {
    return validateClaimRecord(JSON.parse(raw), jobId);
  } catch {
    return null;
  }
};

export const getCalculationJobPollClaimStorageKey = (
  token,
  jobId,
  { deriveScopeKey = deriveMarketRefreshScopeKey } = {},
) => {
  if (typeof jobId !== 'string' || !JOB_ID_RE.test(jobId)) {
    throw new TypeError('A valid calculation job ID is required');
  }
  if (typeof deriveScopeKey !== 'function') throw new TypeError('deriveScopeKey must be a function');
  const scopeKey = deriveScopeKey(token);
  if (typeof scopeKey !== 'string' || !scopeKey) throw new Error('Calculation poll scope is unavailable');
  return `${CALCULATION_JOB_POLL_CLAIM_STORAGE_PREFIX}${scopeKey}.${jobId}`;
};

export async function claimCalculationJobPoll({
  storage = globalThis.localStorage,
  token,
  jobId,
  minimumIntervalMs,
  now = () => Date.now(),
  delay = defaultDelay,
  randomId = createDefaultRandomId,
  deriveScopeKey = deriveMarketRefreshScopeKey,
  settleMs = CALCULATION_JOB_POLL_CLAIM_SETTLE_MS,
} = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return false;
  }
  if (
    typeof now !== 'function'
    || typeof delay !== 'function'
    || typeof randomId !== 'function'
    || !Number.isFinite(minimumIntervalMs)
    || minimumIntervalMs <= 0
    || !Number.isFinite(settleMs)
    || settleMs < 0
    || settleMs >= minimumIntervalMs
  ) {
    return false;
  }

  let storageKey;
  try {
    storageKey = getCalculationJobPollClaimStorageKey(token, jobId, { deriveScopeKey });
  } catch {
    return false;
  }

  let current;
  try {
    current = parseClaimRecord(storage.getItem(storageKey), jobId);
  } catch {
    return false;
  }

  const claimedAt = now();
  if (!validTimestamp(claimedAt)) return false;
  if (current && claimedAt < current.nextAllowedAt) return false;

  let claimId;
  try {
    claimId = randomId();
  } catch {
    return false;
  }
  if (typeof claimId !== 'string' || !claimId) return false;

  const candidate = {
    version: CALCULATION_JOB_POLL_CLAIM_VERSION,
    jobId,
    claimId,
    claimedAt,
    nextAllowedAt: claimedAt + minimumIntervalMs,
  };

  try {
    storage.setItem(storageKey, JSON.stringify(candidate));
  } catch {
    return false;
  }

  await delay(settleMs);

  try {
    const confirmation = parseClaimRecord(storage.getItem(storageKey), jobId);
    return confirmation?.claimId === claimId
      && confirmation.claimedAt === claimedAt
      && confirmation.nextAllowedAt === candidate.nextAllowedAt;
  } catch {
    return false;
  }
}

export function clearCalculationJobPollClaim(
  storage,
  token,
  jobId,
  { deriveScopeKey = deriveMarketRefreshScopeKey } = {},
) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  let storageKey;
  try {
    storageKey = getCalculationJobPollClaimStorageKey(token, jobId, { deriveScopeKey });
  } catch {
    return false;
  }
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
