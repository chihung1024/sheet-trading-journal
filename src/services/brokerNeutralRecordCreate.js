import { readApiJson } from './apiResponse.js';
import {
  beginRecordCreateIntent,
  completeRecordCreateIntent,
  markRecordCreateIntentTerminal,
} from './recordCreateIntent.js';
import {
  isExplicitServerRejection,
  markRequestOutcome,
} from './requestErrors.js';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithDeadline,
} from './fetchDeadline.js';

const RECORD_ENDPOINT = '/api/records/idempotent';

const definiteLocalError = (message) => {
  const error = new Error(message);
  error.outcomeAmbiguous = false;
  return error;
};

const normalizeApiBaseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw definiteLocalError('API base URL is required for canonical import');
  }
  return value.trim().replace(/\/$/, '');
};

const postIntentOnce = async (
  intent,
  token,
  {
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => (
  fetchWithDeadline(
    `${normalizeApiBaseUrl(apiBaseUrl)}${RECORD_ENDPOINT}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': intent.idempotencyKey,
      },
      body: intent.body,
    },
    {
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      fetchImpl,
      responseHandler: response => readApiJson(response, { endpoint: RECORD_ENDPOINT }),
    },
  )
);

const postIntentWithRefresh = async (
  intent,
  {
    getToken,
    refreshToken,
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => {
  if (typeof getToken !== 'function') throw definiteLocalError('getToken must be a function');
  let token = getToken();
  if (!token) throw definiteLocalError('請先登入');

  try {
    return await postIntentOnce(intent, token, { apiBaseUrl, fetchImpl });
  } catch (cause) {
    const error = markRequestOutcome(cause, 'POST');
    if (error?.status !== 401 || typeof refreshToken !== 'function') throw error;
    let refreshed = false;
    try {
      refreshed = await refreshToken();
    } catch (refreshError) {
      error.refreshError = refreshError;
      throw error;
    }
    token = getToken();
    if (refreshed !== true || !token) throw error;
    try {
      return await postIntentOnce(intent, token, { apiBaseUrl, fetchImpl });
    } catch (retryCause) {
      throw markRequestOutcome(retryCause, 'POST');
    }
  }
};

const settleConfirmedIntent = (storage, intent) => {
  try {
    completeRecordCreateIntent(storage, intent.owner, intent.idempotencyKey);
    return null;
  } catch (cleanupError) {
    try {
      markRecordCreateIntentTerminal(
        storage,
        intent.owner,
        intent.idempotencyKey,
        { reason: 'CONFIRMED_COMMIT_CLEANUP_DEGRADED' },
      );
    } catch (tombstoneError) {
      cleanupError.tombstoneError = tombstoneError;
    }
    return cleanupError;
  }
};

export const createBrokerNeutralRecord = async (
  entry,
  {
    storage = globalThis.localStorage,
    owner,
    getToken,
    refreshToken,
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => {
  if (
    !entry
    || typeof entry !== 'object'
    || !entry.record
    || typeof entry.record !== 'object'
    || Array.isArray(entry.record)
    || typeof entry.idempotencyKey !== 'string'
  ) {
    throw definiteLocalError('A validated canonical import entry is required');
  }
  if (typeof owner !== 'string' || !owner.trim()) throw definiteLocalError('請先登入');
  if (typeof getToken !== 'function' || !getToken()) throw definiteLocalError('請先登入');

  const intent = beginRecordCreateIntent(
    storage,
    owner,
    entry.record,
    { idempotencyKey: entry.idempotencyKey },
  );

  let response;
  try {
    response = await postIntentWithRefresh(intent, {
      getToken,
      refreshToken,
      apiBaseUrl,
      fetchImpl,
    });
  } catch (cause) {
    const error = markRequestOutcome(cause, 'POST');
    if (isExplicitServerRejection(error)) {
      try {
        markRecordCreateIntentTerminal(
          storage,
          intent.owner,
          intent.idempotencyKey,
          { reason: error?.apiCode || (error?.status ? `HTTP_${error.status}` : 'REJECTED') },
        );
      } catch (storageError) {
        error.recoveryStateError = storageError;
      }
    }
    throw error;
  }

  if (response?.success !== true) {
    const error = definiteLocalError('Canonical record create was not confirmed');
    try {
      markRecordCreateIntentTerminal(
        storage,
        intent.owner,
        intent.idempotencyKey,
        { reason: 'UNCONFIRMED_RESPONSE' },
      );
    } catch (storageError) {
      error.recoveryStateError = storageError;
    }
    throw error;
  }

  const recoveryStateError = settleConfirmedIntent(storage, intent);
  return Object.freeze({
    committed: true,
    outcomeAmbiguous: false,
    deduplicated: response?.deduplicated === true,
    recordId: response?.record_id ?? null,
    response,
    recoveryStateError,
  });
};

export const __test = Object.freeze({
  normalizeApiBaseUrl,
  postIntentOnce,
  postIntentWithRefresh,
  settleConfirmedIntent,
});
