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
import { decodeJwtClaims } from './jwtClaims.js';
import {
  readEligibleRecordCreateIntents,
  rotateRecordMutationBarrier,
} from './recordCreateIntent.js';
import { markAutomaticRecalculationDirty } from './automaticRecalculationState.js';

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

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const normalizeBenchmark = value => (
  typeof value === 'string' ? value.trim().toUpperCase() : ''
);

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
  constructor({ succeeded, total, failedRecordId, cause, recoveryStateError = null }) {
    super(`Record tag batch failed after ${succeeded} of ${total} successful update(s)`);
    this.name = 'PartialRecordTagBatchError';
    this.succeeded = succeeded;
    this.total = total;
    this.failedRecordId = failedRecordId;
    this.outcomeAmbiguous = cause?.outcomeAmbiguous === true;
    this.cause = cause;
    this.recoveryStateError = recoveryStateError;
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

const requireSignedBatchOwner = (token) => {
  let claims;
  try {
    claims = decodeJwtClaims(token);
  } catch (cause) {
    throw new RecordTagUpdateError('Authentication token claims are invalid', {
      code: 'AUTH_TOKEN_INVALID',
      outcomeAmbiguous: false,
      cause,
    });
  }
  const owner = normalizeOwner(claims?.email);
  if (!owner) {
    throw new RecordTagUpdateError('Authentication token has no signed tenant email', {
      code: 'AUTH_OWNER_MISSING',
      outcomeAmbiguous: false,
    });
  }
  return owner;
};

const prepareBatchLifecycle = ({ token, storage, benchmark }) => {
  // Pure transport/unit-test callers may deliberately omit browser storage.
  // Production browser callers provide localStorage and therefore enter this
  // lifecycle before the first mutation is sent.
  if (!storage) return null;

  const owner = requireSignedBatchOwner(token);
  const normalizedBenchmark = normalizeBenchmark(
    benchmark || storage.getItem('user_benchmark') || 'SPY',
  );
  if (!normalizedBenchmark) {
    throw new RecordTagUpdateError('Automatic recalculation benchmark is unavailable', {
      code: 'RECOVERY_BENCHMARK_MISSING',
      outcomeAmbiguous: false,
    });
  }

  let pendingCreateIntents;
  try {
    pendingCreateIntents = readEligibleRecordCreateIntents(storage, owner);
    if (pendingCreateIntents.length > 0) {
      rotateRecordMutationBarrier(storage, owner);
    }
  } catch (cause) {
    throw new RecordTagUpdateError('Unable to establish record mutation recovery barrier', {
      code: 'RECOVERY_BARRIER_FAILED',
      outcomeAmbiguous: false,
      cause,
    });
  }

  return Object.freeze({
    storage,
    owner,
    benchmark: normalizedBenchmark,
    supersededPendingCreate: pendingCreateIntents.length > 0,
  });
};

const markBatchDirty = (lifecycle) => {
  if (!lifecycle) return null;
  return markAutomaticRecalculationDirty(
    lifecycle.storage,
    lifecycle.owner,
    lifecycle.benchmark,
  );
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
  storage = globalThis.localStorage,
  benchmark = '',
}) {
  if (!Array.isArray(updates)) throw new TypeError('updates must be an array');
  const total = updates.length;
  if (total === 0) return { succeeded: 0, total: 0, recoveryGeneration: null };

  let lifecycle;
  try {
    lifecycle = prepareBatchLifecycle({ token, storage, benchmark });
  } catch (cause) {
    const firstRecordId = updates[0]?.record?.id ?? null;
    throw new PartialRecordTagBatchError({
      succeeded: 0,
      total,
      failedRecordId: firstRecordId,
      cause,
    });
  }

  let succeeded = 0;
  let recoveryGeneration = null;

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

      if (!recoveryGeneration && lifecycle) {
        try {
          recoveryGeneration = markBatchDirty(lifecycle);
        } catch (recoveryStateError) {
          const cause = new RecordTagUpdateError(
            'Record update committed but automatic recalculation state could not be saved',
            {
              recordId: record?.id ?? null,
              code: 'RECOVERY_STATE_FAILED',
              outcomeAmbiguous: false,
              cause: recoveryStateError,
            },
          );
          throw new PartialRecordTagBatchError({
            succeeded,
            total,
            failedRecordId: record?.id ?? null,
            cause,
            recoveryStateError,
          });
        }
      }
    } catch (cause) {
      if (cause instanceof PartialRecordTagBatchError) throw cause;

      let recoveryStateError = null;
      if (cause?.outcomeAmbiguous === true && !recoveryGeneration && lifecycle) {
        try {
          recoveryGeneration = markBatchDirty(lifecycle);
        } catch (error) {
          recoveryStateError = error;
        }
      }

      throw new PartialRecordTagBatchError({
        succeeded,
        total,
        failedRecordId: record?.id ?? null,
        cause,
        recoveryStateError,
      });
    }
  }

  return {
    succeeded,
    total,
    recoveryGeneration,
  };
}

export const RECORD_TAG_UPDATE_FIELDS = RECORD_UPDATE_FIELDS;
