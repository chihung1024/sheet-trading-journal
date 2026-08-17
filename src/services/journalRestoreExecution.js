import { readApiJson } from './apiResponse.js';
import { createJournalBackup } from './journalBackupExport.js';
import { fetchWithDeadline } from './fetchDeadline.js';
import {
  ApiHttpError,
  MalformedApiResponseError,
  markRequestOutcome,
} from './requestErrors.js';
import {
  buildJournalRestorePreview,
  validateJournalRestoreBackup,
} from './journalRestorePreview.js';

export const JOURNAL_RESTORE_ENDPOINT = '/api/journal-restore';
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const DEFINITE_NO_COMMIT_SERVER_CODES = new Set([
  'RESTORE_SCHEMA_UNAVAILABLE',
]);

const normalizeBaseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('API base URL is required');
  return value.trim().replace(/\/$/, '');
};

const requireToken = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Authentication token is required');
  return value.trim();
};

const requireIdempotencyKey = (value) => {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_RE.test(value)) {
    throw new Error('Restore idempotency key is invalid');
  }
  return value;
};

const readCapabilityPayload = async (response) => {
  try {
    const value = await response.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export const probeJournalRestoreCapability = async ({
  apiBaseUrl,
  fetchImpl = globalThis.fetch,
}) => {
  const base = normalizeBaseUrl(apiBaseUrl);
  try {
    const response = await fetchWithDeadline(`${base}${JOURNAL_RESTORE_ENDPOINT}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, { fetchImpl });
    const payload = await readCapabilityPayload(response);
    const apiCode = typeof payload?.error_meta?.code === 'string' ? payload.error_meta.code : null;
    const available = response.status === 405 && payload?.success === false && apiCode === 'METHOD_NOT_ALLOWED';

    return Object.freeze({
      available,
      reason: available
        ? null
        : response.status === 404
          ? 'route_unavailable'
          : 'unexpected_capability_contract',
      status: response.status,
      api_code: apiCode,
      source_commit: response.headers.get('X-Source-Commit') || null,
      worker_version_id: response.headers.get('X-Worker-Version-Id') || null,
    });
  } catch (error) {
    return Object.freeze({
      available: false,
      reason: 'capability_check_failed',
      status: Number.isInteger(error?.status) ? error.status : null,
      api_code: error?.apiCode || null,
      source_commit: null,
      worker_version_id: null,
      error,
    });
  }
};

const authenticatedRestorePost = async ({
  apiBaseUrl,
  backup,
  idempotencyKey,
  getToken,
  refreshToken,
  fetchImpl,
}) => {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  if (typeof refreshToken !== 'function') throw new TypeError('refreshToken must be a function');
  const base = normalizeBaseUrl(apiBaseUrl);
  const body = JSON.stringify(backup);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = requireToken(getToken());
    const response = await fetchWithDeadline(`${base}${JOURNAL_RESTORE_ENDPOINT}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body,
    }, { fetchImpl });

    if (response.status === 401 && attempt === 0) {
      let refreshed = false;
      try {
        refreshed = await refreshToken();
      } catch (error) {
        error.outcomeAmbiguous = false;
        throw error;
      }
      if (!refreshed) {
        throw new ApiHttpError('Authentication required', {
          status: 401,
          apiCode: 'UNAUTHORIZED',
        });
      }
      continue;
    }
    return readApiJson(response, { endpoint: 'Journal restore' });
  }

  throw new ApiHttpError('Authentication required', {
    status: 401,
    apiCode: 'UNAUTHORIZED',
  });
};

const validateRestoreSuccess = (payload, backup) => {
  const restored = payload?.restored === true;
  const deduplicated = payload?.deduplicated === true;
  if (restored === deduplicated) {
    throw new MalformedApiResponseError('Journal restore response did not identify restore or replay');
  }
  if (payload?.verification_required !== true) {
    throw new MalformedApiResponseError('Journal restore response omitted verification requirement');
  }
  const recordCount = payload?.counts?.records;
  const cashCount = payload?.counts?.cash_events;
  if (
    !Number.isSafeInteger(recordCount)
    || !Number.isSafeInteger(cashCount)
    || recordCount !== backup.counts.records
    || cashCount !== backup.counts.cash_events
  ) {
    throw new MalformedApiResponseError('Journal restore response counts do not match the accepted backup');
  }

  return Object.freeze({
    restored,
    deduplicated,
    counts: Object.freeze({ records: recordCount, cash_events: cashCount }),
    verification_required: true,
  });
};

export const executeJournalRestore = async ({
  backup,
  idempotencyKey,
  apiBaseUrl,
  getToken,
  refreshToken,
  fetchImpl = globalThis.fetch,
}) => {
  const source = validateJournalRestoreBackup(backup);
  const key = requireIdempotencyKey(idempotencyKey);

  try {
    const payload = await authenticatedRestorePost({
      apiBaseUrl,
      backup: source,
      idempotencyKey: key,
      getToken,
      refreshToken,
      fetchImpl,
    });
    return validateRestoreSuccess(payload, source);
  } catch (error) {
    const contextualError = markRequestOutcome(error, 'POST');
    if (DEFINITE_NO_COMMIT_SERVER_CODES.has(contextualError?.apiCode)) {
      contextualError.outcomeAmbiguous = false;
    }
    throw contextualError;
  }
};

export const verifyJournalRestoreReadback = async ({
  backup,
  apiBaseUrl,
  getToken,
  refreshToken,
  fetchImpl = globalThis.fetch,
}) => {
  const source = validateJournalRestoreBackup(backup);
  const current = await createJournalBackup({
    apiBaseUrl,
    getToken,
    refreshToken,
    fetchImpl,
  });
  const preview = buildJournalRestorePreview({ backup: source, current });
  return Object.freeze({
    verified: preview.status === 'already_restored',
    preview,
    current,
  });
};
