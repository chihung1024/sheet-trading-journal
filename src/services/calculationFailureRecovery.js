import { CALCULATION_FAILURE_RECOVERY_STORAGE_KEY } from './projectStorage.js';

export const CALCULATION_FAILURE_RECOVERY_VERSION = 1;
export const MAX_AUTOMATIC_FAILURE_RETRIES_PER_GENERATION = 1;
export const CALCULATION_FAILURE_RECOVERY_CLAIM_SETTLE_MS = 75;

export const FAILURE_RECOVERY_CLASS = Object.freeze({
  RETRYABLE_TRANSIENT: 'retryable_transient',
  USER_ACTION_REQUIRED: 'user_action_required',
  INTEGRITY_STOP: 'integrity_stop',
  OPERATIONS_STOP: 'operations_stop',
  UNKNOWN_STOP: 'unknown_stop',
});

const TOKEN_RE = /^[A-Za-z0-9._-]{16,128}$/;
const CLAIM_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;
const ERROR_CODE_RE = /^[A-Z0-9_]{1,64}$/;
const MAX_FUTURE_SKEW_MS = 60_000;

const RETRYABLE_CODES = new Set([
  'GITHUB_DISPATCH_TIMEOUT',
  'GITHUB_DISPATCH_FAILED',
  'RECORDS_API_FAILED',
  'SETTINGS_API_FAILED',
  'MARKET_DATA_FAILED',
  'SNAPSHOT_UPLOAD_FAILED',
]);

const USER_ACTION_CODES = new Set([
  'RECORD_VALIDATION_FAILED',
]);

const INTEGRITY_STOP_CODES = new Set([
  'RECONCILIATION_FAILED',
  'SNAPSHOT_VALIDATION_FAILED',
]);

const OPERATIONS_STOP_CODES = new Set([
  'CONFIGURATION_FAILED',
  'GITHUB_DISPATCH_NOT_CONFIGURED',
  'GITHUB_DISPATCH_INVALID_RESPONSE',
  'GITHUB_AUTH_FAILED',
  'GITHUB_PERMISSION_DENIED',
  'GITHUB_WORKFLOW_NOT_FOUND',
  'GITHUB_DISPATCH_REJECTED',
]);

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const normalizeExplicitErrorCode = value => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return ERROR_CODE_RE.test(code) ? code : '';
};

const normalizeErrorCode = value => (
  normalizeExplicitErrorCode(value) || 'UNKNOWN_CALCULATION_FAILED'
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

const parseObject = raw => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const createDefaultClaimId = () => {
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

const validateState = (value, owner, { now = Date.now() } = {}) => {
  const expectedOwner = normalizeOwner(owner);
  if (
    value?.version !== CALCULATION_FAILURE_RECOVERY_VERSION
    || !expectedOwner
    || normalizeOwner(value.owner) !== expectedOwner
    || typeof value.generationToken !== 'string'
    || !TOKEN_RE.test(value.generationToken)
    || typeof value.claimId !== 'string'
    || !CLAIM_ID_RE.test(value.claimId)
    || !Number.isSafeInteger(value.attempts)
    || value.attempts < 1
    || value.attempts > MAX_AUTOMATIC_FAILURE_RETRIES_PER_GENERATION
    || typeof value.lastErrorCode !== 'string'
    || !ERROR_CODE_RE.test(value.lastErrorCode)
    || !Number.isFinite(value.claimedAt)
    || value.claimedAt <= 0
    || value.claimedAt > now + MAX_FUTURE_SKEW_MS
  ) {
    return null;
  }
  return Object.freeze({
    version: CALCULATION_FAILURE_RECOVERY_VERSION,
    owner: expectedOwner,
    generationToken: value.generationToken,
    claimId: value.claimId,
    attempts: value.attempts,
    lastErrorCode: value.lastErrorCode,
    claimedAt: value.claimedAt,
  });
};

export const triageCalculationFailure = ({
  errorCode = '',
  source = 'job',
  outcomeAmbiguous = false,
} = {}) => {
  const explicitCode = normalizeExplicitErrorCode(errorCode);
  const code = explicitCode || 'UNKNOWN_CALCULATION_FAILED';
  const normalizedSource = source === 'trigger' ? 'trigger' : 'job';

  if (RETRYABLE_CODES.has(code)) {
    return Object.freeze({
      classification: FAILURE_RECOVERY_CLASS.RETRYABLE_TRANSIENT,
      retryable: true,
      errorCode: code,
      source: normalizedSource,
      reason: 'allowlisted_transient_failure',
    });
  }
  if (USER_ACTION_CODES.has(code)) {
    return Object.freeze({
      classification: FAILURE_RECOVERY_CLASS.USER_ACTION_REQUIRED,
      retryable: false,
      errorCode: code,
      source: normalizedSource,
      reason: 'authoritative_record_validation_failed',
    });
  }
  if (INTEGRITY_STOP_CODES.has(code)) {
    return Object.freeze({
      classification: FAILURE_RECOVERY_CLASS.INTEGRITY_STOP,
      retryable: false,
      errorCode: code,
      source: normalizedSource,
      reason: 'financial_integrity_gate_failed',
    });
  }
  if (OPERATIONS_STOP_CODES.has(code)) {
    return Object.freeze({
      classification: FAILURE_RECOVERY_CLASS.OPERATIONS_STOP,
      retryable: false,
      errorCode: code,
      source: normalizedSource,
      reason: 'service_configuration_failed',
    });
  }
  if (
    normalizedSource === 'trigger'
    && outcomeAmbiguous === true
    && explicitCode === ''
  ) {
    return Object.freeze({
      classification: FAILURE_RECOVERY_CLASS.RETRYABLE_TRANSIENT,
      retryable: true,
      errorCode: code,
      source: normalizedSource,
      reason: 'idempotent_trigger_outcome_ambiguous',
    });
  }
  return Object.freeze({
    classification: FAILURE_RECOVERY_CLASS.UNKNOWN_STOP,
    retryable: false,
    errorCode: code,
    source: normalizedSource,
    reason: explicitCode
      ? 'explicit_error_not_allowlisted_for_automatic_retry'
      : 'not_allowlisted_for_automatic_retry',
  });
};

export const readCalculationFailureRecoveryState = (storage, owner, options = {}) => (
  validateState(
    parseObject(requireStorage(storage).getItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY)),
    owner,
    options,
  )
);

export const claimAutomaticFailureRetry = async (
  storage,
  owner,
  generationToken,
  triage,
  {
    now = Date.now(),
    settleMs = CALCULATION_FAILURE_RECOVERY_CLAIM_SETTLE_MS,
    delay = defaultDelay,
    createClaimId = createDefaultClaimId,
  } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  if (
    !normalizedOwner
    || typeof generationToken !== 'string'
    || !TOKEN_RE.test(generationToken)
    || triage?.retryable !== true
    || !Number.isFinite(settleMs)
    || settleMs < 0
    || typeof delay !== 'function'
    || typeof createClaimId !== 'function'
  ) {
    return false;
  }

  const existing = readCalculationFailureRecoveryState(target, normalizedOwner, { now });
  if (
    existing?.generationToken === generationToken
    && existing.attempts >= MAX_AUTOMATIC_FAILURE_RETRIES_PER_GENERATION
  ) {
    return false;
  }

  let claimId;
  try {
    claimId = createClaimId();
  } catch {
    return false;
  }
  if (typeof claimId !== 'string' || !CLAIM_ID_RE.test(claimId)) return false;

  const state = {
    version: CALCULATION_FAILURE_RECOVERY_VERSION,
    owner: normalizedOwner,
    generationToken,
    claimId,
    attempts: 1,
    lastErrorCode: normalizeErrorCode(triage.errorCode),
    claimedAt: now,
  };

  try {
    target.setItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    return false;
  }

  try {
    await delay(settleMs);
  } catch {
    return false;
  }

  const confirmation = readCalculationFailureRecoveryState(target, normalizedOwner);
  return confirmation?.generationToken === generationToken
    && confirmation.claimId === claimId
    && confirmation.attempts === 1
    && confirmation.lastErrorCode === state.lastErrorCode
    && confirmation.claimedAt === now;
};

export const clearCalculationFailureRecoveryState = (
  storage,
  owner,
  { generationToken = null } = {},
) => {
  const target = requireStorage(storage);
  const normalizedOwner = normalizeOwner(owner);
  if (!normalizedOwner) return false;
  const existing = readCalculationFailureRecoveryState(target, normalizedOwner);
  if (!existing) return false;
  if (generationToken !== null && existing.generationToken !== generationToken) return false;
  target.removeItem(CALCULATION_FAILURE_RECOVERY_STORAGE_KEY);
  return true;
};
