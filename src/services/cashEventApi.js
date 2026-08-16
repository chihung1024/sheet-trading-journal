import { fetchWithDeadline } from './fetchDeadline.js';
import { readApiJson } from './apiResponse.js';
import { MalformedApiResponseError, markRequestOutcome } from './requestErrors.js';

const CASH_EVENT_TYPES = new Set(['OPENING_BALANCE', 'DEPOSIT', 'WITHDRAWAL']);
const CASH_CURRENCY_RE = /^[A-Z]{3}$/;

const requireString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value.trim();
};

const requireId = (value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError('Cash event id is invalid');
  return id;
};

export const normalizeCashEventState = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Cash event must be an object');
  }
  const eventDate = requireString(value.event_date, 'Cash event date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new TypeError('Cash event date is invalid');
  const eventType = requireString(value.event_type, 'Cash event type');
  if (!CASH_EVENT_TYPES.has(eventType)) throw new TypeError('Cash event type is invalid');
  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) throw new TypeError('Cash event amount must be finite');
  if (eventType !== 'OPENING_BALANCE' && amount <= 0) {
    throw new TypeError('Deposit/withdrawal amount must be greater than zero');
  }
  const currency = requireString(value.currency, 'Cash currency').toUpperCase();
  if (!CASH_CURRENCY_RE.test(currency)) throw new TypeError('Cash currency must be three letters');
  const note = value.note == null ? '' : String(value.note).trim();
  return Object.freeze({ event_date: eventDate, event_type: eventType, amount, currency, note });
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${requireString(token, 'Authentication token')}`,
  'Content-Type': 'application/json',
});

const requestCashApi = async ({
  apiBaseUrl,
  token,
  method,
  body = null,
  idempotencyKey = null,
  fetchImpl = globalThis.fetch,
}) => {
  const base = requireString(apiBaseUrl, 'API base URL').replace(/\/$/, '');
  const headers = authHeaders(token);
  if (idempotencyKey !== null) headers['Idempotency-Key'] = requireString(idempotencyKey, 'Idempotency key');
  try {
    const response = await fetchWithDeadline(`${base}/api/cash-events`, {
      method,
      headers,
      ...(body === null ? {} : { body: JSON.stringify(body) }),
    }, { fetchImpl });
    return await readApiJson(response, { endpoint: 'Cash events API' });
  } catch (error) {
    throw markRequestOutcome(error, method);
  }
};

const readCashEvent = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MalformedApiResponseError('Cash events API returned an invalid cash event');
  }
  return Object.freeze({
    id: requireId(value.id),
    ...normalizeCashEventState(value),
    event_source: typeof value.event_source === 'string' ? value.event_source : null,
    created_at: typeof value.created_at === 'string' ? value.created_at : null,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  });
};

export const fetchCashEvents = async (options) => {
  const payload = await requestCashApi({ ...options, method: 'GET' });
  if (!Array.isArray(payload.cash_events)) {
    throw new MalformedApiResponseError('Cash events API returned no cash_events array');
  }
  return Object.freeze(payload.cash_events.map(readCashEvent));
};

export const createCashEvent = async ({ event, idempotencyKey, ...options }) => {
  const payload = await requestCashApi({
    ...options,
    method: 'POST',
    idempotencyKey,
    body: normalizeCashEventState(event),
  });
  return Object.freeze({
    cashEvent: readCashEvent(payload.cash_event),
    deduplicated: payload.deduplicated === true,
  });
};

export const updateCashEvent = async ({ id, expected, event, ...options }) => {
  const payload = await requestCashApi({
    ...options,
    method: 'PUT',
    body: {
      id: requireId(id),
      expected: normalizeCashEventState(expected),
      event: normalizeCashEventState(event),
    },
  });
  return readCashEvent(payload.cash_event);
};

export const deleteCashEvent = async ({ id, expected, ...options }) => {
  const payload = await requestCashApi({
    ...options,
    method: 'DELETE',
    body: { id: requireId(id), expected: normalizeCashEventState(expected) },
  });
  if (payload.deleted !== true) {
    throw new MalformedApiResponseError('Cash events API did not confirm deletion');
  }
  return true;
};
