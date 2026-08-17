import { fetchWithDeadline } from './fetchDeadline.js';
import { readApiJson } from './apiResponse.js';
import { buildRecordsPageEndpoint } from './recordPagination.js';

export const JOURNAL_BACKUP_FORMAT = 'sheet-trading-journal-backup';
export const JOURNAL_BACKUP_SCHEMA_VERSION = 1;

const RECORD_PAGE_LIMIT = 1_000;
const RECORD_MAX_PAGES = 100;
const RECORD_MAX_ROWS = 100_000;
const MAX_CURSOR_LENGTH = 2_048;

const RECORD_EXPORT_FIELDS = Object.freeze([
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
  'created_at',
  'currency',
  'executed_at',
  'execution_sequence',
  'event_source',
]);

const CASH_EVENT_EXPORT_FIELDS = Object.freeze([
  'id',
  'event_date',
  'event_type',
  'amount',
  'currency',
  'note',
  'event_source',
  'created_at',
  'updated_at',
]);

const RECORD_SERVER_ONLY_FIELDS = new Set([
  'user_id',
  'create_idempotency_hash',
  'create_payload_hash',
  'create_idempotency_key_hash',
  'create_idempotency_payload_hash',
]);
const CASH_SERVER_ONLY_FIELDS = new Set([
  'user_id',
  'create_idempotency_hash',
  'create_payload_hash',
]);
const RECORD_KNOWN_FIELDS = new Set([...RECORD_EXPORT_FIELDS, ...RECORD_SERVER_ONLY_FIELDS]);
const CASH_KNOWN_FIELDS = new Set([...CASH_EVENT_EXPORT_FIELDS, ...CASH_SERVER_ONLY_FIELDS]);
const RECORD_TYPES = new Set(['BUY', 'SELL', 'DIV']);
const CASH_EVENT_TYPES = new Set(['OPENING_BALANCE', 'DEPOSIT', 'WITHDRAWAL']);
const RECORD_CURRENCY_RE = /^(?:[A-Z]{3}|GBp)$/;
const CASH_CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const plainObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
};

const nonEmptyString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value;
};

const nullableString = (value, label) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`);
  return value;
};

const finiteNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

const positiveId = (value, label) => {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} must be a positive integer`);
  return id;
};

const rejectUnknownFields = (value, knownFields, label) => {
  const unknown = Object.keys(value).filter(key => !knownFields.has(key));
  if (unknown.length) {
    throw new Error(`${label} contains unreviewed server fields: ${unknown.sort().join(', ')}`);
  }
};

const copyRecord = (raw) => {
  const value = plainObject(raw, 'record');
  rejectUnknownFields(value, RECORD_KNOWN_FIELDS, 'record');

  const txnDate = nonEmptyString(value.txn_date, 'record.txn_date');
  if (!DATE_RE.test(txnDate)) throw new Error('record.txn_date is invalid');
  const txnType = nonEmptyString(value.txn_type, 'record.txn_type');
  if (!RECORD_TYPES.has(txnType)) throw new Error('record.txn_type is invalid');
  const currency = nullableString(value.currency, 'record.currency');
  if (currency !== null && !RECORD_CURRENCY_RE.test(currency)) {
    throw new Error('record.currency is invalid');
  }

  return Object.freeze({
    id: positiveId(value.id, 'record.id'),
    txn_date: txnDate,
    symbol: nonEmptyString(value.symbol, 'record.symbol'),
    txn_type: txnType,
    qty: finiteNumber(value.qty, 'record.qty'),
    price: finiteNumber(value.price, 'record.price'),
    fee: finiteNumber(value.fee, 'record.fee'),
    tax: finiteNumber(value.tax, 'record.tax'),
    tag: nullableString(value.tag, 'record.tag') ?? '',
    note: nullableString(value.note, 'record.note') ?? '',
    created_at: nonEmptyString(value.created_at, 'record.created_at'),
    currency,
    executed_at: nullableString(value.executed_at, 'record.executed_at'),
    execution_sequence: nullableString(value.execution_sequence, 'record.execution_sequence'),
    event_source: nullableString(value.event_source, 'record.event_source'),
  });
};

const copyCashEvent = (raw) => {
  const value = plainObject(raw, 'cash event');
  rejectUnknownFields(value, CASH_KNOWN_FIELDS, 'cash event');

  const eventDate = nonEmptyString(value.event_date, 'cash_event.event_date');
  if (!DATE_RE.test(eventDate)) throw new Error('cash_event.event_date is invalid');
  const eventType = nonEmptyString(value.event_type, 'cash_event.event_type');
  if (!CASH_EVENT_TYPES.has(eventType)) throw new Error('cash_event.event_type is invalid');
  const amount = finiteNumber(value.amount, 'cash_event.amount');
  if (eventType !== 'OPENING_BALANCE' && amount <= 0) {
    throw new Error('cash_event.amount must be positive for deposit/withdrawal');
  }
  const currency = nonEmptyString(value.currency, 'cash_event.currency');
  if (!CASH_CURRENCY_RE.test(currency)) throw new Error('cash_event.currency is invalid');

  return Object.freeze({
    id: positiveId(value.id, 'cash_event.id'),
    event_date: eventDate,
    event_type: eventType,
    amount,
    currency,
    note: nullableString(value.note, 'cash_event.note') ?? '',
    event_source: nullableString(value.event_source, 'cash_event.event_source'),
    created_at: nonEmptyString(value.created_at, 'cash_event.created_at'),
    updated_at: nonEmptyString(value.updated_at, 'cash_event.updated_at'),
  });
};

const normalizeBaseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('API base URL is required');
  return value.trim().replace(/\/$/, '');
};

const requireToken = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Authentication token is required');
  return value.trim();
};

const requestAuthenticatedJson = async ({
  apiBaseUrl,
  endpoint,
  getToken,
  refreshToken,
  fetchImpl,
}) => {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  if (typeof refreshToken !== 'function') throw new TypeError('refreshToken must be a function');
  const base = normalizeBaseUrl(apiBaseUrl);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = requireToken(getToken());
    const response = await fetchWithDeadline(`${base}${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }, { fetchImpl });

    if (response.status === 401 && attempt === 0) {
      await refreshToken();
      continue;
    }
    return readApiJson(response, { endpoint: `Journal backup ${endpoint}` });
  }
  throw new Error('Authentication refresh did not restore backup access');
};

const fetchAuthoritativeRecords = async (options) => {
  const records = [];
  const seenIds = new Set();
  const seenCursors = new Set();
  let cursor = null;

  for (let pageNumber = 1; pageNumber <= RECORD_MAX_PAGES; pageNumber += 1) {
    const endpoint = buildRecordsPageEndpoint({ limit: RECORD_PAGE_LIMIT, cursor });
    const payload = await requestAuthenticatedJson({ ...options, endpoint });
    if (!Array.isArray(payload.data)) throw new Error('Backup records response has no data array');
    const page = plainObject(payload.page, 'backup records page');
    if (page.limit !== RECORD_PAGE_LIMIT) throw new Error('Backup records page limit mismatch');
    if (!Number.isSafeInteger(page.count) || page.count !== payload.data.length) {
      throw new Error('Backup records page count mismatch');
    }
    if (typeof page.has_more !== 'boolean') throw new Error('Backup records page has_more is invalid');

    for (const raw of payload.data) {
      const record = copyRecord(raw);
      if (seenIds.has(record.id)) throw new Error(`Duplicate record id in backup read: ${record.id}`);
      seenIds.add(record.id);
      records.push(record);
      if (records.length > RECORD_MAX_ROWS) throw new Error('Backup record count exceeds safety limit');
    }

    if (!page.has_more) {
      if (page.next_cursor !== null && page.next_cursor !== undefined && page.next_cursor !== '') {
        throw new Error('Terminal backup records page contains a cursor');
      }
      return Object.freeze(records);
    }

    if (
      typeof page.next_cursor !== 'string'
      || page.next_cursor.length < 1
      || page.next_cursor.length > MAX_CURSOR_LENGTH
    ) {
      throw new Error('Backup records page is missing a valid cursor');
    }
    if (seenCursors.has(page.next_cursor)) throw new Error('Backup records cursor cycle detected');
    seenCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }

  throw new Error(`Backup records pagination exceeded ${RECORD_MAX_PAGES} pages`);
};

const fetchAuthoritativeCashEvents = async (options) => {
  const payload = await requestAuthenticatedJson({ ...options, endpoint: '/api/cash-events' });
  if (!Array.isArray(payload.cash_events)) throw new Error('Backup cash response has no cash_events array');
  const seenIds = new Set();
  return Object.freeze(payload.cash_events.map((raw) => {
    const event = copyCashEvent(raw);
    if (seenIds.has(event.id)) throw new Error(`Duplicate cash event id in backup read: ${event.id}`);
    seenIds.add(event.id);
    return event;
  }));
};

export const buildJournalBackupPackage = ({ records, cashEvents, generatedAt }) => {
  if (!Array.isArray(records) || !Array.isArray(cashEvents)) {
    throw new TypeError('Backup source collections must be arrays');
  }
  const timestamp = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Backup generatedAt is invalid');

  const safeRecords = Object.freeze(records.map(copyRecord));
  const safeCashEvents = Object.freeze(cashEvents.map(copyCashEvent));

  return Object.freeze({
    format: JOURNAL_BACKUP_FORMAT,
    schema_version: JOURNAL_BACKUP_SCHEMA_VERSION,
    generated_at: timestamp.toISOString(),
    authority: Object.freeze({
      records: 'authenticated_tenant_scoped_api_readback',
      cash_events: 'authenticated_tenant_scoped_api_readback',
      derived_portfolio_snapshot_included: false,
      browser_local_state_included: false,
    }),
    counts: Object.freeze({
      records: safeRecords.length,
      cash_events: safeCashEvents.length,
    }),
    records: safeRecords,
    cash_events: safeCashEvents,
  });
};

export const createJournalBackup = async ({
  apiBaseUrl,
  getToken,
  refreshToken,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) => {
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  const requestOptions = { apiBaseUrl, getToken, refreshToken, fetchImpl };
  const records = await fetchAuthoritativeRecords(requestOptions);
  const cashEvents = await fetchAuthoritativeCashEvents(requestOptions);
  return buildJournalBackupPackage({ records, cashEvents, generatedAt: now() });
};

export const serializeJournalBackup = (backup) => `${JSON.stringify(backup, null, 2)}\n`;

export const buildJournalBackupFilename = (generatedAt) => {
  const timestamp = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Backup filename timestamp is invalid');
  return `sheet-trading-journal-backup-${timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
};

export const downloadJournalBackup = (backup, {
  documentImpl = globalThis.document,
  urlImpl = globalThis.URL,
  BlobImpl = globalThis.Blob,
} = {}) => {
  plainObject(backup, 'backup package');
  if (backup.format !== JOURNAL_BACKUP_FORMAT || backup.schema_version !== JOURNAL_BACKUP_SCHEMA_VERSION) {
    throw new Error('Backup package contract is invalid');
  }
  if (!documentImpl?.createElement || !urlImpl?.createObjectURL || !urlImpl?.revokeObjectURL || !BlobImpl) {
    throw new Error('Browser download capability is unavailable');
  }

  const blob = new BlobImpl([serializeJournalBackup(backup)], { type: 'application/json;charset=utf-8' });
  const url = urlImpl.createObjectURL(blob);
  const anchor = documentImpl.createElement('a');
  anchor.href = url;
  anchor.download = buildJournalBackupFilename(backup.generated_at);
  anchor.style.display = 'none';
  documentImpl.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    urlImpl.revokeObjectURL(url);
  }
  return anchor.download;
};

export const JOURNAL_BACKUP_RECORD_FIELDS = RECORD_EXPORT_FIELDS;
export const JOURNAL_BACKUP_CASH_EVENT_FIELDS = CASH_EVENT_EXPORT_FIELDS;
