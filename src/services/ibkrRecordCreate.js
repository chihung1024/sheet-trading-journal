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

const RECORD_ENDPOINT = '/api/records';
const IMPORT_ID_RE = /^IBKR~/;

const secureOpaqueId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random ID generation is unavailable');
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const hashImportIdentity = async (importIdentity) => {
  if (typeof importIdentity !== 'string' || !IMPORT_ID_RE.test(importIdentity) || importIdentity.length > 128) {
    throw new Error('IBKR import identity is invalid');
  }
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error('Secure digest is unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(importIdentity),
  );
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `ibkr.${hex}`;
};

const createIntentIdFactory = (durableKey) => {
  let call = 0;
  return () => {
    call += 1;
    if (call === 1) return secureOpaqueId();
    if (call === 2) return durableKey;
    throw new Error('Unexpected record-create opaque ID request');
  };
};

export const beginIbkrRecordCreateIntent = async (
  storage,
  owner,
  record,
  importIdentity,
) => {
  const durableKey = await hashImportIdentity(importIdentity);
  const intent = beginRecordCreateIntent(storage, owner, record, {
    createOpaqueId: createIntentIdFactory(durableKey),
  });
  if (intent.idempotencyKey !== durableKey) {
    throw new Error('IBKR durable record-create key was not preserved');
  }
  return intent;
};

const normalizeApiBaseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('API base URL is required for IBKR import');
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
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  let token = getToken();
  if (!token) {
    const error = new Error('請先登入');
    error.outcomeAmbiguous = false;
    throw error;
  }

  try {
    return await postIntentOnce(intent, token, { apiBaseUrl, fetchImpl });
  } catch (error) {
    if (error?.status !== 401 || typeof refreshToken !== 'function') throw error;
    const refreshed = await refreshToken();
    token = getToken();
    if (refreshed !== true || !token) throw error;
    return postIntentOnce(intent, token, { apiBaseUrl, fetchImpl });
  }
};

export const createIbkrRecord = async (
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
  if (!entry || typeof entry !== 'object' || !entry.record || typeof entry.idempotencyKey !== 'string') {
    throw new TypeError('A validated IBKR import entry is required');
  }
  if (typeof owner !== 'string' || !owner.trim()) {
    const error = new Error('請先登入');
    error.outcomeAmbiguous = false;
    throw error;
  }
  if (typeof getToken !== 'function' || !getToken()) {
    const error = new Error('請先登入');
    error.outcomeAmbiguous = false;
    throw error;
  }

  const intent = await beginIbkrRecordCreateIntent(
    storage,
    owner,
    entry.record,
    entry.idempotencyKey,
  );

  try {
    const response = await postIntentWithRefresh(intent, {
      getToken,
      refreshToken,
      apiBaseUrl,
      fetchImpl,
    });
    completeRecordCreateIntent(storage, intent.owner, intent.idempotencyKey);
    return Object.freeze({
      committed: true,
      outcomeAmbiguous: false,
      deduplicated: response?.deduplicated === true,
      recordId: response?.record_id ?? null,
      response,
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
};

export const __test = Object.freeze({
  hashImportIdentity,
  createIntentIdFactory,
  normalizeApiBaseUrl,
  postIntentOnce,
  postIntentWithRefresh,
});
