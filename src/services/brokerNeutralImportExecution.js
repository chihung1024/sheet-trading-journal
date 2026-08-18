import {
  BROKER_NEUTRAL_IMPORT_PREVIEW_VERSION,
  CANONICAL_TRADE_CSV_FORMAT,
  buildCanonicalTradeCsvPreview,
} from './brokerNeutralImportPreview.js';

export const CANONICAL_IMPORT_EXECUTION_VERSION = 1;
export const CANONICAL_IMPORT_SOURCE_PROFILE_MAX_LENGTH = 64;
export const CANONICAL_IMPORT_EVENT_SOURCE = 'IMPORT';

const IMPORT_KEY_RE = /^csvg1\.[0-9a-f]{64}\.r\d{1,6}$/;

export class BrokerNeutralImportExecutionError extends Error {
  constructor(message, code = 'CANONICAL_IMPORT_NOT_READY') {
    super(message);
    this.name = 'BrokerNeutralImportExecutionError';
    this.code = code;
    this.outcomeAmbiguous = false;
  }
}

const normalizeProfileDisplay = (value) => {
  const normalized = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new BrokerNeutralImportExecutionError('請輸入固定的匯入來源設定檔名稱', 'SOURCE_PROFILE_REQUIRED');
  }
  if (normalized.length > CANONICAL_IMPORT_SOURCE_PROFILE_MAX_LENGTH) {
    throw new BrokerNeutralImportExecutionError(
      `匯入來源設定檔不可超過 ${CANONICAL_IMPORT_SOURCE_PROFILE_MAX_LENGTH} 字元`,
      'SOURCE_PROFILE_TOO_LONG',
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BrokerNeutralImportExecutionError('匯入來源設定檔含不支援的控制字元', 'SOURCE_PROFILE_INVALID');
  }
  return normalized;
};

export const normalizeCanonicalImportSourceProfile = (value) => {
  const displayName = normalizeProfileDisplay(value);
  return Object.freeze({
    displayName,
    scopeId: displayName.toLowerCase(),
  });
};

const sha256Hex = async (value) => {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new BrokerNeutralImportExecutionError('瀏覽器不支援安全雜湊，無法建立防重複識別', 'SECURE_DIGEST_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

const assertExecutionReadyPreview = (preview) => {
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
    throw new BrokerNeutralImportExecutionError('Canonical CSV 預覽不存在', 'PREVIEW_REQUIRED');
  }
  if (
    preview.preview_version !== BROKER_NEUTRAL_IMPORT_PREVIEW_VERSION
    || preview.format !== CANONICAL_TRADE_CSV_FORMAT
    || preview.writes_allowed !== false
  ) {
    throw new BrokerNeutralImportExecutionError('Canonical CSV 預覽契約不相容', 'PREVIEW_CONTRACT_MISMATCH');
  }
  if (
    preview.status !== 'ready'
    || preview.counts?.rows <= 0
    || preview.counts?.blocked !== 0
    || preview.counts?.ready !== preview.counts?.rows
    || !Array.isArray(preview.rows)
    || preview.rows.length !== preview.counts.rows
    || preview.rows.some(row => row?.status !== 'ready')
  ) {
    throw new BrokerNeutralImportExecutionError(
      'CSV 必須全部通過預覽檢查後才能匯入；不執行部分匯入',
      'PREVIEW_NOT_FULLY_READY',
    );
  }
};

const buildRecord = (row) => {
  const payload = row.payload;
  return Object.freeze({
    txn_date: payload.txn_date,
    symbol: payload.symbol,
    txn_type: payload.txn_type,
    qty: payload.qty,
    price: payload.price,
    fee: payload.fee,
    tax: payload.tax,
    tag: payload.tag || 'Stock',
    note: payload.note || '',
    currency: payload.currency,
    executed_at: payload.executed_at || null,
    execution_sequence: payload.execution_sequence || null,
    event_source: CANONICAL_IMPORT_EVENT_SOURCE,
  });
};

export const prepareCanonicalTradeImport = async (
  sourceText,
  sourceProfile,
  { fileSizeBytes = null } = {},
) => {
  if (typeof sourceText !== 'string' || !sourceText) {
    throw new BrokerNeutralImportExecutionError('Canonical CSV 來源文字不存在', 'SOURCE_TEXT_REQUIRED');
  }

  const profile = normalizeCanonicalImportSourceProfile(sourceProfile);
  const preview = buildCanonicalTradeCsvPreview(sourceText, { fileSizeBytes });
  assertExecutionReadyPreview(preview);

  // Idempotency is intentionally scoped to the explicit source profile plus the
  // exact source text. We do not use transaction-field similarity because two
  // economically identical rows can both be legitimate trades. Reordered or
  // edited files are therefore treated as a new source unless the source itself
  // provides a future authoritative transaction identifier.
  const sourceDigest = await sha256Hex([
    CANONICAL_TRADE_CSV_FORMAT,
    `profile:${profile.scopeId}`,
    sourceText,
  ].join('\n'));

  const entries = preview.rows.map((row) => {
    const idempotencyKey = `csvg1.${sourceDigest}.r${row.row_number}`;
    if (!IMPORT_KEY_RE.test(idempotencyKey)) {
      throw new BrokerNeutralImportExecutionError('Canonical import idempotency key is invalid', 'IDEMPOTENCY_KEY_INVALID');
    }
    return Object.freeze({
      rowNumber: row.row_number,
      idempotencyKey,
      record: buildRecord(row),
    });
  });

  return Object.freeze({
    execution_version: CANONICAL_IMPORT_EXECUTION_VERSION,
    format: CANONICAL_TRADE_CSV_FORMAT,
    source_profile: profile.displayName,
    source_digest: sourceDigest,
    preview,
    entries: Object.freeze(entries),
  });
};

export const __test = Object.freeze({
  sha256Hex,
  assertExecutionReadyPreview,
  buildRecord,
});
