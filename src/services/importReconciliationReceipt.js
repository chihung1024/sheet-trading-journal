export const IMPORT_RECONCILIATION_RECEIPT_VERSION = 1;

const STATUS_PRESENTATION = Object.freeze({
  created: Object.freeze({ label: '已新增', tone: 'success' }),
  replayed: Object.freeze({ label: '已存在（安全重播）', tone: 'neutral' }),
  rejected: Object.freeze({ label: '已拒絕', tone: 'error' }),
  ambiguous: Object.freeze({ label: '回應不確定', tone: 'warning' }),
});

const requireNonNegativeInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
};

const sourceReferenceLabel = (reference, position) => {
  if (reference?.kind === 'source_record' && Number.isSafeInteger(reference.value) && reference.value > 0) {
    return `來源資料第 ${reference.value} 筆`;
  }
  if (reference?.kind === 'source_row' && Number.isSafeInteger(reference.value) && reference.value > 0) {
    return `CSV 第 ${reference.value} 列`;
  }
  return `匯入第 ${position} 筆`;
};

const presentItem = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError('receipt item must be an object');
  }
  const presentation = STATUS_PRESENTATION[item.status];
  if (!presentation) throw new TypeError(`unsupported receipt item status: ${item.status}`);
  const position = requireNonNegativeInteger(item.position, 'item.position');
  if (position < 1) throw new TypeError('item.position must be positive');

  const notes = [];
  if (item.metadataUpdated === true) notes.push('來源資訊已補充');
  if (item.metadataWarning === true) {
    notes.push(item.metadataOutcomeAmbiguous === true ? '來源資訊補充結果不確定' : '來源資訊尚未補齊');
  }
  if (item.recoveryWarning === true) notes.push('本機恢復狀態清理需留意');

  return Object.freeze({
    position,
    reference: sourceReferenceLabel(item.sourceReference, position),
    status: item.status,
    label: presentation.label,
    tone: presentation.tone,
    committed: item.committed === true,
    outcome_ambiguous: item.outcomeAmbiguous === true,
    notes: Object.freeze(notes),
  });
};

const buildSyncMessages = (sync = {}) => {
  const messages = [];
  if (sync.readbackError) messages.push('交易寫入結果已保留，但權威交易紀錄重新載入尚未完成。');
  if (sync.updateError) messages.push('交易寫入結果已保留，但投資組合重新計算尚未完成。');
  if ((sync.recoveryWarnings?.length || 0) > 0) {
    messages.push(`有 ${sync.recoveryWarnings.length} 筆已確認交易的本機恢復狀態清理需留意。`);
  }
  if ((sync.metadataWarnings?.length || 0) > 0) {
    messages.push(`有 ${sync.metadataWarnings.length} 筆交易的來源資訊補充尚未完全確認。`);
  }
  return Object.freeze(messages);
};

export const buildImportReconciliationReceipt = (result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('record import result is required');
  }
  if (!Array.isArray(result.items)) throw new TypeError('record import result items are required');

  const total = requireNonNegativeInteger(result.total, 'result.total');
  const attempted = requireNonNegativeInteger(result.attempted ?? result.items.length, 'result.attempted');
  const unattempted = requireNonNegativeInteger(
    result.unattempted ?? Math.max(0, total - attempted),
    'result.unattempted',
  );
  if (attempted !== result.items.length) throw new TypeError('attempted count must equal receipt items length');
  if (attempted + unattempted !== total) throw new TypeError('attempted + unattempted must equal total');

  const rows = Object.freeze(result.items.map(presentItem));
  const sync_messages = buildSyncMessages(result.sync || {});

  return Object.freeze({
    receipt_version: IMPORT_RECONCILIATION_RECEIPT_VERSION,
    status: String(result.status || ''),
    total,
    attempted,
    unattempted,
    created: requireNonNegativeInteger(result.created, 'result.created'),
    replayed: requireNonNegativeInteger(result.replayed, 'result.replayed'),
    rows,
    has_sync_warning: sync_messages.length > 0,
    sync_messages,
  });
};

export const __test = Object.freeze({
  sourceReferenceLabel,
  presentItem,
  buildSyncMessages,
});
