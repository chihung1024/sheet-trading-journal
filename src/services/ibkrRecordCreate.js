import { readApiJson } from './apiResponse.js';
import { extractIbkrUserJournalNote } from './ibkrJournalNote.js';
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
const RECORD_METADATA_ENDPOINT = '/api/records/metadata';
const RECORD_METADATA_FIELDS = Object.freeze(['currency', 'executed_at', 'execution_sequence', 'event_source']);
const IMPORT_ID_RE = /^IBKR~/;
const SENSITIVE_NOTE_FIELD_RE = /^(?:account(?:_?id|_?number)?|client_?account_?id)\s*=/i;

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

const sanitizeIbkrRecordForPersistence = (record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('IBKR record must be an object');
  }
  // Strip the full legacy IBKR envelope first because execution timestamps use
  // `YYYYMMDD;HHMMSS`, where the semicolon is data rather than a note separator.
  const userJournalNote = extractIbkrUserJournalNote(String(record.note || ''));
  // Keep the older privacy fallback for any account-style assignment that may
  // appear outside a recognized legacy envelope.
  const note = userJournalNote
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !SENSITIVE_NOTE_FIELD_RE.test(part))
    .join('; ');
  return Object.freeze({ ...record, note });
};

const definiteLocalError = (message) => {
  const error = new Error(message);
  error.outcomeAmbiguous = false;
  return error;
};

const buildRecordMetadataEnrichmentPayload = (entry, recordId) => {
  if (!entry?.metadata || typeof entry.metadata !== 'object' || Array.isArray(entry.metadata)) return null;
  const metadata = {};
  for (const field of RECORD_METADATA_FIELDS) {
    if (entry.metadata[field] !== undefined && entry.metadata[field] !== null) {
      metadata[field] = entry.metadata[field];
    }
  }
  if (Object.keys(metadata).length === 0) return null;

  const id = Number(recordId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw definiteLocalError('Committed IBKR record did not return a valid record ID for metadata enrichment');
  }
  const record = sanitizeIbkrRecordForPersistence(entry.record);
  return Object.freeze({
    id,
    txn_date: record.txn_date,
    symbol: record.symbol,
    txn_type: record.txn_type,
    qty: record.qty,
    price: record.price,
    fee: record.fee,
    tax: record.tax,
    ...metadata,
  });
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
  const intent = beginRecordCreateIntent(
    storage,
    owner,
    sanitizeIbkrRecordForPersistence(record),
    { createOpaqueId: createIntentIdFactory(durableKey) },
  );
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
    let refreshed = false;
    try {
      refreshed = await refreshToken();
    } catch (refreshError) {
      error.refreshError = refreshError;
      throw error;
    }
    token = getToken();
    if (refreshed !== true || !token) throw error;
    return postIntentOnce(intent, token, { apiBaseUrl, fetchImpl });
  }
};

const putMetadataOnce = async (
  payload,
  token,
  {
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => (
  fetchWithDeadline(
    `${normalizeApiBaseUrl(apiBaseUrl)}${RECORD_METADATA_ENDPOINT}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    {
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      fetchImpl,
      responseHandler: response => readApiJson(response, { endpoint: RECORD_METADATA_ENDPOINT }),
    },
  )
);

const putMetadataWithRefresh = async (
  payload,
  {
    getToken,
    refreshToken,
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  let token = getToken();
  if (!token) throw definiteLocalError('請先登入');

  try {
    return await putMetadataOnce(payload, token, { apiBaseUrl, fetchImpl });
  } catch (cause) {
    const error = markRequestOutcome(cause, 'PUT');
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
      return await putMetadataOnce(payload, token, { apiBaseUrl, fetchImpl });
    } catch (retryCause) {
      throw markRequestOutcome(retryCause, 'PUT');
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

  const recordId = response?.record_id ?? null;
  const recoveryStateError = settleConfirmedIntent(storage, intent);
  let metadataUpdated = false;
  let metadataResponse = null;
  let metadataEnrichmentError = null;
  let metadataOutcomeAmbiguous = false;

  try {
    const metadataPayload = buildRecordMetadataEnrichmentPayload(entry, recordId);
    if (metadataPayload) {
      metadataResponse = await putMetadataWithRefresh(metadataPayload, {
        getToken,
        refreshToken,
        apiBaseUrl,
        fetchImpl,
      });
      metadataUpdated = metadataResponse?.metadata_updated === true;
    }
  } catch (error) {
    metadataEnrichmentError = error;
    metadataOutcomeAmbiguous = error?.outcomeAmbiguous === true;
  }

  return Object.freeze({
    committed: true,
    outcomeAmbiguous: false,
    deduplicated: response?.deduplicated === true,
    recordId,
    response,
    recoveryStateError,
    metadataUpdated,
    metadataResponse,
    metadataEnrichmentError,
    metadataOutcomeAmbiguous,
  });
};

export const __test = Object.freeze({
  hashImportIdentity,
  sanitizeIbkrRecordForPersistence,
  createIntentIdFactory,
  normalizeApiBaseUrl,
  postIntentOnce,
  postIntentWithRefresh,
  buildRecordMetadataEnrichmentPayload,
  putMetadataOnce,
  putMetadataWithRefresh,
  settleConfirmedIntent,
});
