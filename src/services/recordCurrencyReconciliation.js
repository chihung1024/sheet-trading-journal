import { readApiJson } from './apiResponse.js';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithDeadline,
} from './fetchDeadline.js';
import { normalizeNativeCurrency } from './instrumentCurrency.js';
import { markRequestOutcome } from './requestErrors.js';
import { getStoredRecordCurrency } from './recordHistoryPresentation.js';

const RECORD_METADATA_ENDPOINT = '/api/records/metadata';
const DEFAULT_CONCURRENCY = 4;

const definiteLocalError = (message) => {
  const error = new Error(message);
  error.outcomeAmbiguous = false;
  return error;
};

const normalizeApiBaseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw definiteLocalError('API base URL is required');
  }
  return value.trim().replace(/\/$/, '');
};

const finiteNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw definiteLocalError(`Record ${field} is invalid`);
  }
  return number;
};

export const buildRecordCurrencyMetadataPayload = (record, currency) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw definiteLocalError('A record is required');
  }

  const id = Number(record.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw definiteLocalError('Record ID is invalid');
  }

  const normalizedCurrency = normalizeNativeCurrency(currency);
  if (!normalizedCurrency) {
    throw definiteLocalError('Currency must be a three-letter code or GBp');
  }

  const txnDate = String(record.txn_date || '').trim();
  const symbol = String(record.symbol || '').trim().toUpperCase();
  const txnType = String(record.txn_type || '').trim().toUpperCase();
  if (!txnDate || !symbol || !['BUY', 'SELL', 'DIV'].includes(txnType)) {
    throw definiteLocalError('Record economic identity is incomplete');
  }

  return Object.freeze({
    id,
    txn_date: txnDate,
    symbol,
    txn_type: txnType,
    qty: finiteNumber(record.qty, 'qty'),
    price: finiteNumber(record.price, 'price'),
    fee: finiteNumber(record.fee ?? 0, 'fee'),
    tax: finiteNumber(record.tax ?? 0, 'tax'),
    currency: normalizedCurrency,
  });
};

const putMetadataOnce = async (
  payload,
  token,
  {
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => fetchWithDeadline(
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
);

export const putRecordCurrencyMetadata = async (
  record,
  currency,
  {
    getToken,
    refreshToken,
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
  } = {},
) => {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  const payload = buildRecordCurrencyMetadataPayload(record, currency);
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

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }));

  return results;
};

const safeErrorSummary = (error) => Object.freeze({
  status: Number.isInteger(error?.status) ? error.status : null,
  apiCode: typeof error?.apiCode === 'string' ? error.apiCode : null,
  outcomeAmbiguous: error?.outcomeAmbiguous === true,
});

export const reconcileRecordCurrencies = async (
  selections,
  {
    getToken,
    refreshToken,
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
    refreshRecords,
    readRecords,
    concurrency = DEFAULT_CONCURRENCY,
  } = {},
) => {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw definiteLocalError('At least one record currency confirmation is required');
  }
  if (typeof refreshRecords !== 'function' || typeof readRecords !== 'function') {
    throw new TypeError('refreshRecords and readRecords must be functions');
  }

  const normalizedSelections = selections.map(({ record, currency }) => Object.freeze({
    record,
    currency: normalizeNativeCurrency(currency),
  }));
  for (const selection of normalizedSelections) {
    if (!selection.currency) throw definiteLocalError('Every selected record needs a valid currency');
  }

  const maxConcurrency = Number.isInteger(concurrency) && concurrency > 0
    ? Math.min(concurrency, DEFAULT_CONCURRENCY)
    : DEFAULT_CONCURRENCY;

  const attempts = await mapWithConcurrency(normalizedSelections, maxConcurrency, async (selection) => {
    try {
      const response = await putRecordCurrencyMetadata(selection.record, selection.currency, {
        getToken,
        refreshToken,
        apiBaseUrl,
        fetchImpl,
      });
      return Object.freeze({
        id: Number(selection.record.id),
        desiredCurrency: selection.currency,
        response,
        error: null,
      });
    } catch (error) {
      return Object.freeze({
        id: Number(selection.record.id),
        desiredCurrency: selection.currency,
        response: null,
        error: safeErrorSummary(error),
      });
    }
  });

  try {
    await refreshRecords();
  } catch (error) {
    return Object.freeze({
      readbackSucceeded: false,
      confirmed: Object.freeze([]),
      unconfirmed: Object.freeze(attempts),
      readbackError: safeErrorSummary(error),
    });
  }

  const refreshedRecords = readRecords();
  if (!Array.isArray(refreshedRecords)) {
    throw definiteLocalError('Refreshed records are unavailable');
  }
  const recordsById = new Map(refreshedRecords.map(record => [Number(record?.id), record]));
  const confirmed = [];
  const unconfirmed = [];

  for (const attempt of attempts) {
    const refreshed = recordsById.get(attempt.id);
    if (refreshed && getStoredRecordCurrency(refreshed) === attempt.desiredCurrency) {
      confirmed.push(attempt);
    } else {
      unconfirmed.push(attempt);
    }
  }

  return Object.freeze({
    readbackSucceeded: true,
    confirmed: Object.freeze(confirmed),
    unconfirmed: Object.freeze(unconfirmed),
    readbackError: null,
  });
};

export const __test = Object.freeze({
  DEFAULT_CONCURRENCY,
  safeErrorSummary,
});