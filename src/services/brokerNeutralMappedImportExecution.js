import { CANONICAL_HEADERS } from './brokerNeutralImportPreview.js';
import {
  BROKER_NEUTRAL_MAPPING_PREVIEW_VERSION,
  buildMappedCanonicalTradePreview,
} from './brokerNeutralColumnMapping.js';
import {
  BrokerNeutralImportExecutionError,
  buildCanonicalImportRecord,
  normalizeCanonicalImportSourceProfile,
} from './brokerNeutralImportExecution.js';

export const MAPPED_IMPORT_EXECUTION_VERSION = 1;
export const MAPPED_IMPORT_FORMAT = 'broker-column-mapping-v1';

const MAPPED_IMPORT_KEY_RE = /^csvm1\.[0-9a-f]{64}\.r\d{1,6}$/;

const sha256Hex = async (value) => {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new BrokerNeutralImportExecutionError(
      '瀏覽器不支援安全雜湊，無法建立欄位對應匯入的防重複識別',
      'SECURE_DIGEST_UNAVAILABLE',
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const serializeMappedImportContract = (normalizedMapping) => {
  if (!normalizedMapping || typeof normalizedMapping !== 'object' || Array.isArray(normalizedMapping)) {
    throw new BrokerNeutralImportExecutionError('欄位對應契約不存在', 'MAPPING_CONTRACT_REQUIRED');
  }

  const contract = CANONICAL_HEADERS.map((field) => {
    const entry = normalizedMapping[field] ?? null;
    if (entry === null) return [field, null];
    if (entry.mode === 'column') return [field, 'column', entry.source_header];
    if (entry.mode === 'constant') return [field, 'constant', entry.value];
    throw new BrokerNeutralImportExecutionError(
      `欄位 ${field} 的 normalized mapping mode 無效`,
      'MAPPING_CONTRACT_INVALID',
    );
  });
  return JSON.stringify(contract);
};

const assertMappedPreviewReady = (mappedPreview) => {
  if (!mappedPreview || typeof mappedPreview !== 'object' || Array.isArray(mappedPreview)) {
    throw new BrokerNeutralImportExecutionError('欄位對應預覽不存在', 'MAPPED_PREVIEW_REQUIRED');
  }
  if (
    mappedPreview.mapping_preview_version !== BROKER_NEUTRAL_MAPPING_PREVIEW_VERSION
    || mappedPreview.writes_allowed !== false
    || !mappedPreview.mapping
  ) {
    throw new BrokerNeutralImportExecutionError('欄位對應預覽契約不相容', 'MAPPED_PREVIEW_CONTRACT_MISMATCH');
  }

  const canonical = mappedPreview.canonical_preview;
  if (
    canonical?.status !== 'ready'
    || canonical?.counts?.rows <= 0
    || canonical?.counts?.blocked !== 0
    || canonical?.counts?.ready !== canonical?.counts?.rows
    || !Array.isArray(canonical?.rows)
    || canonical.rows.length !== canonical.counts.rows
    || canonical.rows.some(row => row?.status !== 'ready')
    || mappedPreview.source_row_count !== canonical.rows.length
  ) {
    throw new BrokerNeutralImportExecutionError(
      '欄位對應後必須全部通過 Canonical v1 檢查才能匯入',
      'MAPPED_PREVIEW_NOT_FULLY_READY',
    );
  }
};

export const prepareMappedBrokerImport = async (
  sourceText,
  mapping,
  sourceProfile,
  { fileSizeBytes = null } = {},
) => {
  if (typeof sourceText !== 'string' || !sourceText) {
    throw new BrokerNeutralImportExecutionError('原始券商 CSV 來源不存在', 'SOURCE_TEXT_REQUIRED');
  }

  const profile = normalizeCanonicalImportSourceProfile(sourceProfile);
  const mappedPreview = buildMappedCanonicalTradePreview(sourceText, mapping, { fileSizeBytes });
  assertMappedPreviewReady(mappedPreview);

  const mappingContract = serializeMappedImportContract(mappedPreview.mapping);
  const sourceDigest = await sha256Hex([
    MAPPED_IMPORT_FORMAT,
    `profile:${profile.scopeId}`,
    `mapping:${mappingContract}`,
    sourceText,
  ].join('\n'));

  const entries = mappedPreview.canonical_preview.rows.map((row, index) => {
    const sourceRecordNumber = index + 1;
    const idempotencyKey = `csvm1.${sourceDigest}.r${sourceRecordNumber}`;
    if (!MAPPED_IMPORT_KEY_RE.test(idempotencyKey)) {
      throw new BrokerNeutralImportExecutionError(
        '欄位對應匯入 idempotency key 無效',
        'IDEMPOTENCY_KEY_INVALID',
      );
    }
    return Object.freeze({
      sourceRecordNumber,
      rowNumber: row.row_number,
      idempotencyKey,
      record: buildCanonicalImportRecord(row),
    });
  });

  return Object.freeze({
    execution_version: MAPPED_IMPORT_EXECUTION_VERSION,
    format: MAPPED_IMPORT_FORMAT,
    source_profile: profile.displayName,
    source_digest: sourceDigest,
    mapping_contract: mappingContract,
    mapped_preview: mappedPreview,
    entries: Object.freeze(entries),
  });
};

export const __test = Object.freeze({
  sha256Hex,
  assertMappedPreviewReady,
});
