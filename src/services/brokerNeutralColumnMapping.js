import {
  CANONICAL_HEADERS,
  MAX_CANONICAL_CSV_BYTES,
  MAX_CANONICAL_CSV_ROWS,
  OPTIONAL_CANONICAL_HEADERS,
  REQUIRED_CANONICAL_HEADERS,
  buildCanonicalTradeCsvPreview,
} from './brokerNeutralImportPreview.js';

export const BROKER_NEUTRAL_MAPPING_PREVIEW_VERSION = 1;
export const MAPPING_SOURCE_MODE = Object.freeze({
  COLUMN: 'column',
  CONSTANT: 'constant',
});

export const CONSTANT_MAPPING_FIELDS = Object.freeze([
  'txn_type',
  'currency',
  'tag',
  'note',
]);

const CANONICAL_FIELD_SET = new Set(CANONICAL_HEADERS);
const REQUIRED_FIELD_SET = new Set(REQUIRED_CANONICAL_HEADERS);
const CONSTANT_FIELD_SET = new Set(CONSTANT_MAPPING_FIELDS);

export class BrokerNeutralColumnMappingError extends Error {
  constructor(message, code = 'INVALID_COLUMN_MAPPING') {
    super(message);
    this.name = 'BrokerNeutralColumnMappingError';
    this.code = code;
    this.outcomeAmbiguous = false;
  }
}

const fail = (message, code) => {
  throw new BrokerNeutralColumnMappingError(message, code);
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function parseCsvMatrixStrict(text) {
  if (typeof text !== 'string') fail('CSV 內容必須是文字', 'INVALID_TEXT');

  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (afterQuote) {
      if (char === ',') {
        row.push(field);
        field = '';
        afterQuote = false;
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        afterQuote = false;
      } else if (char === '\r' && source[index + 1] === '\n') {
        // CRLF is completed by the following newline.
      } else {
        fail('CSV 引號結束後只能接逗號、換行或檔案結尾', 'MALFORMED_CSV');
      }
      continue;
    }

    if (char === '"') {
      if (field.length !== 0) fail('CSV 引號只能出現在欄位開頭', 'MALFORMED_CSV');
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

  if (quoted) fail('CSV 有未關閉的引號', 'MALFORMED_CSV');

  if (field.length > 0 || row.length > 0 || afterQuote) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows.filter(candidate => candidate.some(value => String(value).trim() !== ''));
}

const validateFileSize = (fileSizeBytes) => {
  if (fileSizeBytes === null || fileSizeBytes === undefined) return;
  if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 0) {
    fail('檔案大小證據無效', 'INVALID_FILE_SIZE');
  }
  if (fileSizeBytes > MAX_CANONICAL_CSV_BYTES) {
    fail('CSV 超過 2 MiB 上限', 'FILE_TOO_LARGE');
  }
};

export function parseBrokerSourceCsv(text, { fileSizeBytes = null } = {}) {
  validateFileSize(fileSizeBytes);
  const matrix = parseCsvMatrixStrict(text);
  if (matrix.length === 0) fail('來源 CSV 沒有標題列', 'EMPTY_FILE');

  const headers = matrix[0].map(value => String(value).trim());
  if (headers.length === 0 || headers.some(header => !header)) {
    fail('來源 CSV 每個欄位都必須有明確欄名', 'EMPTY_SOURCE_HEADER');
  }

  const seen = new Set();
  const duplicates = new Set();
  for (const header of headers) {
    if (seen.has(header)) duplicates.add(header);
    seen.add(header);
  }
  if (duplicates.size > 0) {
    fail(`來源 CSV 欄名不可重複：${[...duplicates].join(', ')}`, 'DUPLICATE_SOURCE_HEADERS');
  }

  const sourceRows = matrix.slice(1);
  if (sourceRows.length > MAX_CANONICAL_CSV_ROWS) {
    fail('CSV 超過 10,000 筆交易上限', 'TOO_MANY_ROWS');
  }

  for (let index = 0; index < sourceRows.length; index += 1) {
    if (sourceRows[index].length !== headers.length) {
      fail(
        `來源第 ${index + 2} 筆資料欄位數 ${sourceRows[index].length} 與標題 ${headers.length} 不一致`,
        'SOURCE_COLUMN_COUNT_MISMATCH',
      );
    }
  }

  return Object.freeze({
    headers: Object.freeze([...headers]),
    rows: Object.freeze(sourceRows.map((values, index) => Object.freeze({
      source_record_number: index + 1,
      source_display_row: index + 2,
      values: Object.freeze([...values]),
    }))),
  });
}

export function createEmptyBrokerColumnMapping() {
  return Object.freeze(Object.fromEntries(CANONICAL_HEADERS.map(field => [field, null])));
}

const normalizeMappingEntry = (canonicalField, entry, sourceHeaderSet) => {
  if (entry === null || entry === undefined || entry === '') return null;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail(`${canonicalField} 的欄位對應格式無效`, 'INVALID_MAPPING_ENTRY');
  }

  if (entry.mode === MAPPING_SOURCE_MODE.COLUMN) {
    const sourceHeader = String(entry.source_header ?? '').trim();
    if (!sourceHeader || !sourceHeaderSet.has(sourceHeader)) {
      fail(`${canonicalField} 指向不存在的來源欄位`, 'UNKNOWN_SOURCE_HEADER');
    }
    return Object.freeze({ mode: MAPPING_SOURCE_MODE.COLUMN, source_header: sourceHeader });
  }

  if (entry.mode === MAPPING_SOURCE_MODE.CONSTANT) {
    if (!CONSTANT_FIELD_SET.has(canonicalField)) {
      fail(`${canonicalField} 不允許使用固定值`, 'CONSTANT_NOT_ALLOWED');
    }
    const value = String(entry.value ?? '').trim();
    if (!value && REQUIRED_FIELD_SET.has(canonicalField)) {
      fail(`${canonicalField} 的固定值不可空白`, 'EMPTY_REQUIRED_CONSTANT');
    }
    return Object.freeze({ mode: MAPPING_SOURCE_MODE.CONSTANT, value });
  }

  fail(`${canonicalField} 的欄位對應模式無效`, 'INVALID_MAPPING_MODE');
};

export function validateBrokerColumnMapping(sourceTable, mapping) {
  if (!sourceTable || !Array.isArray(sourceTable.headers) || !Array.isArray(sourceTable.rows)) {
    fail('來源 CSV 尚未完成解析', 'SOURCE_TABLE_REQUIRED');
  }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    fail('欄位對應設定不存在', 'MAPPING_REQUIRED');
  }

  const unknownFields = Object.keys(mapping).filter(field => !CANONICAL_FIELD_SET.has(field));
  if (unknownFields.length > 0) {
    fail(`欄位對應包含未知 Canonical 欄位：${unknownFields.join(', ')}`, 'UNKNOWN_CANONICAL_FIELD');
  }

  const sourceHeaderSet = new Set(sourceTable.headers);
  const normalized = {};
  for (const field of CANONICAL_HEADERS) {
    normalized[field] = normalizeMappingEntry(field, mapping[field], sourceHeaderSet);
  }

  const missingRequired = REQUIRED_CANONICAL_HEADERS.filter(field => normalized[field] === null);
  if (missingRequired.length > 0) {
    fail(`尚未對應必要欄位：${missingRequired.join(', ')}`, 'MISSING_REQUIRED_MAPPING');
  }

  return Object.freeze(normalized);
}

const mappedValue = (entry, sourceRow, headerIndex) => {
  if (!entry) return '';
  if (entry.mode === MAPPING_SOURCE_MODE.CONSTANT) return entry.value;
  return sourceRow.values[headerIndex.get(entry.source_header)] ?? '';
};

export function buildMappedCanonicalTradePreview(
  sourceText,
  mapping,
  { fileSizeBytes = null } = {},
) {
  const source = parseBrokerSourceCsv(sourceText, { fileSizeBytes });
  const normalizedMapping = validateBrokerColumnMapping(source, mapping);
  const headerIndex = new Map(source.headers.map((header, index) => [header, index]));

  const mappedHeaders = CANONICAL_HEADERS.filter(field => (
    REQUIRED_FIELD_SET.has(field) || normalizedMapping[field] !== null
  ));
  const canonicalLines = [mappedHeaders.map(csvEscape).join(',')];

  for (const sourceRow of source.rows) {
    canonicalLines.push(mappedHeaders
      .map(field => csvEscape(mappedValue(normalizedMapping[field], sourceRow, headerIndex)))
      .join(','));
  }

  const mappedCanonicalText = `${canonicalLines.join('\r\n')}\r\n`;
  const canonicalPreview = buildCanonicalTradeCsvPreview(mappedCanonicalText, {
    fileSizeBytes: new TextEncoder().encode(mappedCanonicalText).byteLength,
  });

  return Object.freeze({
    mapping_preview_version: BROKER_NEUTRAL_MAPPING_PREVIEW_VERSION,
    writes_allowed: false,
    source_headers: source.headers,
    source_row_count: source.rows.length,
    mapping: normalizedMapping,
    mapped_headers: Object.freeze(mappedHeaders),
    mapped_canonical_text: mappedCanonicalText,
    canonical_preview: canonicalPreview,
  });
}

export const __test = Object.freeze({
  parseCsvMatrixStrict,
  csvEscape,
  mappedValue,
});
