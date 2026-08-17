import {
  JOURNAL_BACKUP_FORMAT,
  JOURNAL_BACKUP_SCHEMA_VERSION,
  buildJournalBackupPackage,
  createJournalBackup,
} from './journalBackupExport.js';

export const JOURNAL_RESTORE_PREVIEW_VERSION = 1;

const BACKUP_FIELDS = Object.freeze([
  'format',
  'schema_version',
  'generated_at',
  'authority',
  'counts',
  'records',
  'cash_events',
]);
const AUTHORITY_FIELDS = Object.freeze([
  'records',
  'cash_events',
  'derived_portfolio_snapshot_included',
  'browser_local_state_included',
]);
const COUNT_FIELDS = Object.freeze(['records', 'cash_events']);
const RECORD_PORTABLE_FIELDS = Object.freeze([
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'fee',
  'tax',
  'tag',
  'note',
  'currency',
  'executed_at',
  'execution_sequence',
  'event_source',
]);
const CASH_PORTABLE_FIELDS = Object.freeze([
  'event_date',
  'event_type',
  'amount',
  'currency',
  'note',
  'event_source',
]);

const requirePlainObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
};

const rejectUnknownFields = (value, fields, label) => {
  const allowed = new Set(fields);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) {
    throw new Error(`${label} contains unsupported fields: ${unknown.sort().join(', ')}`);
  }
};

const requireExactFields = (value, fields, label) => {
  rejectUnknownFields(value, fields, label);
  const missing = fields.filter(field => !Object.prototype.hasOwnProperty.call(value, field));
  if (missing.length) {
    throw new Error(`${label} is missing required fields: ${missing.join(', ')}`);
  }
};

const requireCount = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is invalid`);
  return value;
};

const validateAuthorityManifest = (authority) => {
  const value = requirePlainObject(authority, 'backup.authority');
  requireExactFields(value, AUTHORITY_FIELDS, 'backup.authority');
  if (value.records !== 'authenticated_tenant_scoped_api_readback') {
    throw new Error('backup.authority.records is unsupported');
  }
  if (value.cash_events !== 'authenticated_tenant_scoped_api_readback') {
    throw new Error('backup.authority.cash_events is unsupported');
  }
  if (value.derived_portfolio_snapshot_included !== false) {
    throw new Error('Backup unexpectedly includes derived portfolio authority');
  }
  if (value.browser_local_state_included !== false) {
    throw new Error('Backup unexpectedly includes browser-local authority');
  }
};

const validateCounts = (counts, records, cashEvents) => {
  const value = requirePlainObject(counts, 'backup.counts');
  requireExactFields(value, COUNT_FIELDS, 'backup.counts');
  const recordCount = requireCount(value.records, 'backup.counts.records');
  const cashCount = requireCount(value.cash_events, 'backup.counts.cash_events');
  if (recordCount !== records.length || cashCount !== cashEvents.length) {
    throw new Error('Backup counts do not match backup collections');
  }
};

const assertUniqueSourceIds = (items, label) => {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`${label} contains duplicate source id ${item.id}`);
    ids.add(item.id);
  }
};

export const validateJournalRestoreBackup = (raw) => {
  const value = requirePlainObject(raw, 'backup');
  requireExactFields(value, BACKUP_FIELDS, 'backup');
  if (value.format !== JOURNAL_BACKUP_FORMAT) throw new Error('Backup format is unsupported');
  if (value.schema_version !== JOURNAL_BACKUP_SCHEMA_VERSION) {
    throw new Error(`Backup schema version ${String(value.schema_version)} is unsupported`);
  }
  if (!Array.isArray(value.records) || !Array.isArray(value.cash_events)) {
    throw new Error('Backup collections are invalid');
  }
  validateAuthorityManifest(value.authority);
  validateCounts(value.counts, value.records, value.cash_events);

  const normalized = buildJournalBackupPackage({
    records: value.records,
    cashEvents: value.cash_events,
    generatedAt: value.generated_at,
  });
  assertUniqueSourceIds(normalized.records, 'backup.records');
  assertUniqueSourceIds(normalized.cash_events, 'backup.cash_events');
  return normalized;
};

export const parseJournalRestoreBackupText = (text) => {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Backup file is empty');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }
  return validateJournalRestoreBackup(parsed);
};

const portableProjection = (item, fields) => fields.map(field => item[field] ?? null);
const portableFingerprint = (item, fields) => JSON.stringify(portableProjection(item, fields));

const toMultiset = (items, fields) => {
  const result = new Map();
  for (const item of items) {
    const fingerprint = portableFingerprint(item, fields);
    result.set(fingerprint, (result.get(fingerprint) || 0) + 1);
  }
  return result;
};

const multisetsEqual = (left, right) => {
  if (left.size !== right.size) return false;
  for (const [fingerprint, count] of left) {
    if (right.get(fingerprint) !== count) return false;
  }
  return true;
};

const collectionsMatch = (backup, current) => (
  multisetsEqual(
    toMultiset(backup.records, RECORD_PORTABLE_FIELDS),
    toMultiset(current.records, RECORD_PORTABLE_FIELDS),
  )
  && multisetsEqual(
    toMultiset(backup.cash_events, CASH_PORTABLE_FIELDS),
    toMultiset(current.cash_events, CASH_PORTABLE_FIELDS),
  )
);

export const buildJournalRestorePreview = ({ backup, current }) => {
  const source = validateJournalRestoreBackup(backup);
  const destination = validateJournalRestoreBackup(current);
  const destinationEmpty = destination.records.length === 0 && destination.cash_events.length === 0;
  const exactMatch = collectionsMatch(source, destination);

  let status;
  if (exactMatch) status = 'already_restored';
  else if (destinationEmpty) status = 'empty_ready';
  else status = 'conflict_nonempty';

  return Object.freeze({
    version: JOURNAL_RESTORE_PREVIEW_VERSION,
    status,
    writes_allowed: false,
    backup_generated_at: source.generated_at,
    backup_counts: Object.freeze({ ...source.counts }),
    current_counts: Object.freeze({ ...destination.counts }),
    planned_creates: Object.freeze({
      records: status === 'empty_ready' ? source.records.length : 0,
      cash_events: status === 'empty_ready' ? source.cash_events.length : 0,
    }),
  });
};

export const createJournalRestorePreview = async ({
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
  return buildJournalRestorePreview({ backup: source, current });
};

export const JOURNAL_RESTORE_RECORD_PORTABLE_FIELDS = RECORD_PORTABLE_FIELDS;
export const JOURNAL_RESTORE_CASH_PORTABLE_FIELDS = CASH_PORTABLE_FIELDS;
