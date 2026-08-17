export const BROKER_NEUTRAL_IMPORT_PREVIEW_VERSION = 1;
export const CANONICAL_TRADE_CSV_FORMAT = 'canonical-journal-trades-csv-v1';
export const MAX_CANONICAL_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CANONICAL_CSV_ROWS = 10_000;

export const REQUIRED_CANONICAL_HEADERS = Object.freeze([
  'txn_date',
  'symbol',
  'txn_type',
  'qty',
  'price',
  'currency',
]);

export const OPTIONAL_CANONICAL_HEADERS = Object.freeze([
  'fee',
  'tax',
  'tag',
  'note',
  'executed_at',
  'execution_sequence',
]);

export const CANONICAL_HEADERS = Object.freeze([
  ...REQUIRED_CANONICAL_HEADERS,
  ...OPTIONAL_CANONICAL_HEADERS,
]);

const ALLOWED_HEADER_SET = new Set(CANONICAL_HEADERS);
const SUPPORTED_TXN_TYPES = new Set(['BUY', 'SELL']);
const SYMBOL_RE = /^[A-Z0-9.^=\-]{1,24}$/;
const CURRENCY_RE = /^(?:[A-Z]{3}|GBp)$/;
const EXECUTION_SEQUENCE_RE = /^[A-Za-z0-9._:/-]{1,128}$/;
const OFFSET_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export class BrokerNeutralImportPreviewError extends Error {
  constructor(message, code = 'INVALID_CANONICAL_CSV') {
    super(message);
    this.name = 'BrokerNeutralImportPreviewError';
    this.code = code;
  }
}

const makeIssue = (code, message, field = null) => ({ code, message, field });

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
);

function parseCsvMatrix(text) {
  if (typeof text !== 'string') {
    throw new BrokerNeutralImportPreviewError('CSV 內容必須是文字', 'INVALID_TEXT');
  }

  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length !== 0) {
        throw new BrokerNeutralImportPreviewError('CSV 引號只能出現在欄位開頭', 'MALFORMED_CSV');
      }
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new BrokerNeutralImportPreviewError('CSV 有未關閉的引號', 'MALFORMED_CSV');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => String(value).trim() !== ''));
}

function validateIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseCanonicalNumber(rawValue, field, { required = true, positive = false } = {}) {
  const value = String(rawValue ?? '').trim();
  if (!value) {
    if (required) return { issue: makeIssue('MISSING_VALUE', `${field} 不可空白`, field) };
    return { value: 0 };
  }
  if (!DECIMAL_RE.test(value)) {
    return { issue: makeIssue('INVALID_NUMBER', `${field} 必須使用不含千分位或單位的十進位數字`, field) };
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return { issue: makeIssue('INVALID_NUMBER', `${field} 必須是有限數字`, field) };
  }
  if (positive && number <= 0) {
    return { issue: makeIssue('NON_POSITIVE_NUMBER', `${field} 必須大於 0`, field) };
  }
  return { value: number };
}

function validateOffsetDatetime(value) {
  if (!OFFSET_DATETIME_RE.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function validateHeaders(headers) {
  const issues = [];
  const seen = new Set();
  const duplicates = [];

  for (const header of headers) {
    if (seen.has(header)) duplicates.push(header);
    seen.add(header);
  }

  const missing = REQUIRED_CANONICAL_HEADERS.filter((header) => !seen.has(header));
  const unsupported = headers.filter((header) => !ALLOWED_HEADER_SET.has(header));

  if (duplicates.length > 0) {
    issues.push(makeIssue(
      'DUPLICATE_HEADERS',
      `欄名不可重複：${[...new Set(duplicates)].join(', ')}`,
    ));
  }
  if (missing.length > 0) {
    issues.push(makeIssue('MISSING_REQUIRED_HEADERS', `缺少必要欄位：${missing.join(', ')}`));
  }
  if (unsupported.length > 0) {
    issues.push(makeIssue(
      'UNSUPPORTED_HEADERS',
      `尚未支援的欄位：${[...new Set(unsupported)].join(', ')}；第一版不會猜測或忽略未知財務欄位`,
    ));
  }

  return {
    issues,
    missing,
    unsupported: [...new Set(unsupported)],
    duplicates: [...new Set(duplicates)],
  };
}

function validateRow(values, headers, rowNumber) {
  const issues = [];
  const warnings = [];
  const raw = {};

  if (values.length !== headers.length) {
    issues.push(makeIssue(
      'COLUMN_COUNT_MISMATCH',
      `第 ${rowNumber} 列欄位數 ${values.length} 與標題 ${headers.length} 不一致`,
    ));
  }

  for (let index = 0; index < headers.length; index += 1) {
    if (ALLOWED_HEADER_SET.has(headers[index])) raw[headers[index]] = values[index] ?? '';
  }

  const txnDate = String(raw.txn_date ?? '').trim();
  if (!validateIsoDate(txnDate)) {
    issues.push(makeIssue('INVALID_DATE', 'txn_date 必須是有效的 YYYY-MM-DD', 'txn_date'));
  }

  const symbol = String(raw.symbol ?? '').trim();
  if (!SYMBOL_RE.test(symbol)) {
    issues.push(makeIssue('INVALID_SYMBOL', 'symbol 必須是 1–24 字元的大寫交易代碼', 'symbol'));
  }

  const txnType = String(raw.txn_type ?? '').trim();
  if (!SUPPORTED_TXN_TYPES.has(txnType)) {
    issues.push(makeIssue(
      'UNSUPPORTED_TXN_TYPE',
      'txn_type 第一版僅接受 BUY 或 SELL；DIV 與現金事件需由各自權威流程處理',
      'txn_type',
    ));
  }

  const qtyResult = parseCanonicalNumber(raw.qty, 'qty', { positive: true });
  if (qtyResult.issue) issues.push(qtyResult.issue);
  const priceResult = parseCanonicalNumber(raw.price, 'price', { positive: true });
  if (priceResult.issue) issues.push(priceResult.issue);
  const feeResult = parseCanonicalNumber(raw.fee, 'fee', { required: false });
  if (feeResult.issue) issues.push(feeResult.issue);
  const taxResult = parseCanonicalNumber(raw.tax, 'tax', { required: false });
  if (taxResult.issue) issues.push(taxResult.issue);

  const currency = String(raw.currency ?? '').trim();
  if (!CURRENCY_RE.test(currency)) {
    issues.push(makeIssue(
      'INVALID_CURRENCY',
      'currency 必須是大寫三字母報價單位（或 GBp）；不會由 symbol 推測',
      'currency',
    ));
  }

  const tag = String(raw.tag ?? '').trim();
  if (tag.length > 500) {
    issues.push(makeIssue('TAG_TOO_LONG', 'tag 不可超過 500 字元', 'tag'));
  }

  const note = String(raw.note ?? '').trim();
  if (note.length > 2_000) {
    issues.push(makeIssue('NOTE_TOO_LONG', 'note 不可超過 2000 字元', 'note'));
  }

  const executedAt = String(raw.executed_at ?? '').trim();
  if (executedAt && !validateOffsetDatetime(executedAt)) {
    issues.push(makeIssue(
      'INVALID_EXECUTED_AT',
      'executed_at 必須是含 Z 或時區偏移的 ISO 時間',
      'executed_at',
    ));
  } else if (executedAt && txnDate && executedAt.slice(0, 10) !== txnDate) {
    warnings.push(makeIssue(
      'EXECUTED_DATE_DIFFERS',
      'executed_at 的日期部分與 txn_date 不同；預覽保留原值，不自動改時區或日期',
      'executed_at',
    ));
  }

  const executionSequence = String(raw.execution_sequence ?? '').trim();
  if (executionSequence && !EXECUTION_SEQUENCE_RE.test(executionSequence)) {
    issues.push(makeIssue(
      'INVALID_EXECUTION_SEQUENCE',
      'execution_sequence 僅接受英數字與 . _ : / -，最長 128 字元',
      'execution_sequence',
    ));
  }

  const payload = {
    txn_date: txnDate,
    symbol,
    txn_type: txnType,
    qty: qtyResult.value ?? null,
    price: priceResult.value ?? null,
    fee: feeResult.value ?? null,
    tax: taxResult.value ?? null,
    tag,
    note,
    currency,
    executed_at: executedAt || null,
    execution_sequence: executionSequence || null,
  };

  return {
    row_number: rowNumber,
    status: issues.length === 0 ? 'ready' : 'blocked',
    issues,
    warnings,
    payload,
  };
}

function portableFingerprint(payload) {
  return JSON.stringify([
    payload.txn_date,
    payload.symbol,
    payload.txn_type,
    payload.qty,
    payload.price,
    payload.fee,
    payload.tax,
    payload.tag,
    payload.note,
    payload.currency,
    payload.executed_at,
    payload.execution_sequence,
  ]);
}

function markPreservedDuplicates(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.status !== 'ready') continue;
    const fingerprint = portableFingerprint(row.payload);
    const members = groups.get(fingerprint) || [];
    members.push(row);
    groups.set(fingerprint, members);
  }

  let duplicateGroups = 0;
  let duplicateRows = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    duplicateGroups += 1;
    duplicateRows += members.length;
    for (const row of members) {
      row.warnings.push(makeIssue(
        'DUPLICATE_PORTABLE_FIELDS_PRESERVED',
        `另有 ${members.length - 1} 列具有相同交易欄位；視為獨立來源列保留，不自動去重`,
      ));
    }
  }
  return { duplicateGroups, duplicateRows };
}

export function buildCanonicalTradeCsvPreview(text, { fileSizeBytes = null } = {}) {
  if (fileSizeBytes !== null) {
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 0) {
      throw new BrokerNeutralImportPreviewError('檔案大小證據無效', 'INVALID_FILE_SIZE');
    }
    if (fileSizeBytes > MAX_CANONICAL_CSV_BYTES) {
      throw new BrokerNeutralImportPreviewError('CSV 超過 2 MiB 上限', 'FILE_TOO_LARGE');
    }
  }

  const matrix = parseCsvMatrix(text);
  if (matrix.length === 0) {
    throw new BrokerNeutralImportPreviewError('CSV 沒有標題列', 'EMPTY_FILE');
  }

  const headers = matrix[0].map((value) => String(value));
  if (headers.length === 0 || headers.every((value) => value === '')) {
    throw new BrokerNeutralImportPreviewError('CSV 沒有有效標題列', 'EMPTY_HEADERS');
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > MAX_CANONICAL_CSV_ROWS) {
    throw new BrokerNeutralImportPreviewError('CSV 超過 10,000 筆交易上限', 'TOO_MANY_ROWS');
  }

  const headerCheck = validateHeaders(headers);
  const rows = dataRows.map((values, index) => validateRow(values, headers, index + 2));
  const schemaBlocked = headerCheck.issues.length > 0;

  if (schemaBlocked) {
    for (const row of rows) {
      if (row.status === 'ready') row.status = 'blocked';
    }
  }

  const { duplicateGroups, duplicateRows } = markPreservedDuplicates(rows);
  const ready = rows.filter((row) => row.status === 'ready').length;
  const blocked = rows.length - ready;
  const warningCount = rows.reduce((total, row) => total + row.warnings.length, 0);

  let status = 'ready';
  if (rows.length === 0) status = 'empty';
  else if (schemaBlocked || ready === 0) status = 'blocked';
  else if (blocked > 0) status = 'partial';

  const preview = {
    preview_version: BROKER_NEUTRAL_IMPORT_PREVIEW_VERSION,
    format: CANONICAL_TRADE_CSV_FORMAT,
    writes_allowed: false,
    status,
    headers,
    required_headers: [...REQUIRED_CANONICAL_HEADERS],
    optional_headers: [...OPTIONAL_CANONICAL_HEADERS],
    unsupported_headers: headerCheck.unsupported,
    missing_headers: headerCheck.missing,
    duplicate_headers: headerCheck.duplicates,
    file_issues: headerCheck.issues,
    counts: {
      rows: rows.length,
      ready,
      blocked,
      warnings: warningCount,
      duplicate_groups: duplicateGroups,
      duplicate_rows: duplicateRows,
    },
    rows,
  };

  if (!isPlainObject(preview.counts)) {
    throw new BrokerNeutralImportPreviewError('預覽結果無效', 'INVALID_PREVIEW');
  }
  return preview;
}
