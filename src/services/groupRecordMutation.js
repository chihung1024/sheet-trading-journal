import { readApiJson } from './apiResponse.js';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithDeadline,
} from './fetchDeadline.js';
import {
  ApiApplicationError,
  ApiHttpError,
  markRequestOutcome,
} from './requestErrors.js';

const RECORD_UPDATE_FIELDS = Object.freeze([
  'id',
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
  'note',
]);

function requirePlainObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requirePositiveRecordId(value) {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('record.id must be a positive integer');
  }
  return id;
}

export function buildRecordTagUpdatePayload(record, tag) {
  requirePlainObject(record, 'record');
  if (typeof tag !== 'string') throw new TypeError('tag must be a string');

  const payload = {
    id: requirePositiveRecordId(record.id),
    txn_date: record.txn_date,
    symbol: record.symbol,
    txn_type: record.txn_type,
    qty: record.qty,
    price: record.price,
    fee: record.fee ?? 0,
    tax: record.tax ?? 0,
    tag,
    note: record.note ?? '',
  };

  if (Object.keys(payload).join('|') !== RECORD_UPDATE_FIELDS.join('|')) {
    throw new Error('record update payload schema drifted');
  }
  return payload;
}

export class RecordTagUpdateError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RecordTagUpdateError';
    this.recordId = details.recordId ?? null;
    this.status = details.status ?? null;
    this.code = details.code ?? null;
    this.outcomeAmbiguous = details.outcomeAmbiguous === true;
    this.cause = details.cause;
  }
}

export class PartialRecordTagBatchError extends Error {
  constructor({ succeeded, total, failedRecordId, cause }) {
    super(`Record tag batch failed after ${succeeded} of ${total} successful update(s)`);
    this.name = 'PartialRecordTagBatchError';
    this.succeeded = succeeded;
    this.total = total;
    this.failedRecordId = failedRecordId;
    this.outcomeAmbiguous = cause?.outcomeAmbiguous === true;
    this.cause = cause;
  }
}

const readLegacyRecordTagCode = (error) => {
  if (error?.apiCode) return error.apiCode;
  if (error instanceof ApiHttpError) return 'HTTP_ERROR';
  if (error instanceof ApiApplicationError) return 'APPLICATION_ERROR';
  return error?.code || 'NETWORK_ERROR';
};

const normalizeRecordTagError = (error, recordId) => {
  if (error instanceof RecordTagUpdateError) return error;
  const contextualError = markRequestOutcome(error, 'PUT');
  return new RecordTagUpdateError(contextualError?.message || 'Record update request failed', {
    recordId,
    status: contextualError?.status ?? null,
    code: readLegacyRecordTagCode(contextualError),
    outcomeAmbiguous: contextualError?.outcomeAmbiguous === true,
    cause: contextualError,
  });
};

export async function updateOneRecordTag({
  apiBaseUrl,
  token,
  record,
  tag,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof apiBaseUrl !== 'string' || !apiBaseUrl.trim()) {
    throw new TypeError('apiBaseUrl is required');
  }
  if (typeof token !== 'string' || !token.trim()) {
    throw new RecordTagUpdateError('Authentication token is unavailable', {
      recordId: record?.id ?? null,
      code: 'AUTH_TOKEN_MISSING',
      outcomeAmbiguous: false,
    });
  }

  const payload = buildRecordTagUpdatePayload(record, tag);
  let body;
  try {
    body = await fetchWithDeadline(
      `${apiBaseUrl.replace(/\/+$/, '')}/api/records`,
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
        responseHandler: (response) => readApiJson(response, { endpoint: '/api/records' }),
      },
    );
  } catch (error) {
    throw normalizeRecordTagError(error, payload.id);
  }

  if (!body || body.success !== true) {
    throw new RecordTagUpdateError(body?.error || 'Record update was not confirmed', {
      recordId: payload.id,
      code: body?.error_meta?.code || 'APPLICATION_ERROR',
      outcomeAmbiguous: false,
    });
  }

  return { payload, response: body };
}

export async function updateRecordTagsSequentially({
  apiBaseUrl,
  token,
  updates,
  fetchImpl = globalThis.fetch,
}) {
  if (!Array.isArray(updates)) throw new TypeError('updates must be an array');
  const total = updates.length;
  let succeeded = 0;

  for (const update of updates) {
    const record = requirePlainObject(update, 'update').record;
    try {
      await updateOneRecordTag({
        apiBaseUrl,
        token,
        record,
        tag: update.tag,
        fetchImpl,
      });
      succeeded += 1;
    } catch (cause) {
      throw new PartialRecordTagBatchError({
        succeeded,
        total,
        failedRecordId: record?.id ?? null,
        cause,
      });
    }
  }

  return { succeeded, total };
}

export const RECORD_TAG_UPDATE_FIELDS = RECORD_UPDATE_FIELDS;
