const requireFunction = (value, label) => {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
};

const freezeItem = item => Object.freeze({
  ...item,
  sourceReference: item.sourceReference ? Object.freeze({ ...item.sourceReference }) : null,
});

const freezeResult = value => Object.freeze({
  ...value,
  items: Object.freeze((value.items || []).map(freezeItem)),
  failure: value.failure ? Object.freeze(value.failure) : null,
  sync: Object.freeze({
    ...value.sync,
    recoveryWarnings: Object.freeze(value.sync.recoveryWarnings || []),
    metadataWarnings: Object.freeze(value.sync.metadataWarnings || []),
  }),
});

const sourceReferenceForEntry = (entry, index) => {
  if (Number.isSafeInteger(entry?.sourceRecordNumber) && entry.sourceRecordNumber > 0) {
    return { kind: 'source_record', value: entry.sourceRecordNumber };
  }
  if (Number.isSafeInteger(entry?.rowNumber) && entry.rowNumber > 0) {
    return { kind: 'source_row', value: entry.rowNumber };
  }
  if (Number.isSafeInteger(entry?.source?.firstRowNumber) && entry.source.firstRowNumber > 0) {
    return { kind: 'source_row', value: entry.source.firstRowNumber };
  }
  return { kind: 'import_index', value: index + 1 };
};

const committedReceiptItem = (entry, index, outcome) => ({
  index,
  position: index + 1,
  sourceReference: sourceReferenceForEntry(entry, index),
  status: outcome.deduplicated === true ? 'replayed' : 'created',
  committed: true,
  outcomeAmbiguous: false,
  metadataUpdated: outcome.metadataUpdated === true,
  metadataWarning: Boolean(outcome.metadataEnrichmentError),
  metadataOutcomeAmbiguous: outcome.metadataOutcomeAmbiguous === true,
  recoveryWarning: Boolean(outcome.recoveryStateError),
});

const failedReceiptItem = (entry, index, error) => ({
  index,
  position: index + 1,
  sourceReference: sourceReferenceForEntry(entry, index),
  status: error?.outcomeAmbiguous === true ? 'ambiguous' : 'rejected',
  committed: false,
  outcomeAmbiguous: error?.outcomeAmbiguous === true,
  metadataUpdated: false,
  metadataWarning: false,
  metadataOutcomeAmbiguous: false,
  recoveryWarning: false,
});

export const runRecordImportBatch = async (
  entries,
  {
    createRecord,
    refreshRecords,
    requestUpdate,
  } = {},
) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('At least one validated record import entry is required');
  }
  const create = requireFunction(createRecord, 'createRecord');
  const refresh = requireFunction(refreshRecords, 'refreshRecords');
  const update = requireFunction(requestUpdate, 'requestUpdate');

  let processed = 0;
  let created = 0;
  let replayed = 0;
  let failure = null;
  let metadataUpdated = 0;
  const recoveryWarnings = [];
  const metadataWarnings = [];
  const items = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    try {
      const outcome = await create(entry, index);
      if (outcome?.committed !== true) {
        const error = outcome?.error || new Error('Record import create was not confirmed');
        error.outcomeAmbiguous = outcome?.outcomeAmbiguous === true;
        throw error;
      }
      processed += 1;
      if (outcome.deduplicated === true) replayed += 1;
      else created += 1;
      if (outcome.metadataUpdated === true) metadataUpdated += 1;
      if (outcome.metadataEnrichmentError) {
        metadataWarnings.push(Object.freeze({
          index,
          entry,
          error: outcome.metadataEnrichmentError,
          outcomeAmbiguous: outcome.metadataOutcomeAmbiguous === true,
          deduplicated: outcome.deduplicated === true,
        }));
      }
      if (outcome.recoveryStateError) {
        recoveryWarnings.push(Object.freeze({
          index,
          entry,
          error: outcome.recoveryStateError,
          deduplicated: outcome.deduplicated === true,
        }));
      }
      items.push(committedReceiptItem(entry, index, outcome));
    } catch (error) {
      items.push(failedReceiptItem(entry, index, error));
      failure = {
        index,
        entry,
        error,
        outcomeAmbiguous: error?.outcomeAmbiguous === true,
      };
      break;
    }
  }

  // Server-side replay already proves the same tenant/key/payload exists. Avoid
  // replacing the current records array for replay-only batches because doing so
  // would invalidate snapshot verification despite no ledger mutation.
  const ledgerMayHaveChanged = created > 0 || failure?.outcomeAmbiguous === true;
  const metadataMayHaveChanged = metadataUpdated > 0
    || metadataWarnings.some(item => item.outcomeAmbiguous === true);
  const shouldRefresh = ledgerMayHaveChanged || metadataMayHaveChanged;
  let readbackError = null;
  let updateError = null;
  let readbackAttempted = false;
  let updateAttempted = false;

  if (shouldRefresh) {
    readbackAttempted = true;
    try {
      await refresh();
    } catch (error) {
      readbackError = error;
    }
  }

  if (ledgerMayHaveChanged) {
    updateAttempted = true;
    try {
      await update();
    } catch (error) {
      updateError = error;
    }
  }

  const sync = {
    readbackAttempted,
    readbackError,
    updateAttempted,
    updateError,
    recoveryWarnings,
    metadataWarnings,
  };

  const common = {
    total: entries.length,
    attempted: items.length,
    unattempted: Math.max(0, entries.length - items.length),
    processed,
    created,
    replayed,
    metadataUpdated,
    items,
    sync,
  };

  if (failure) {
    return freezeResult({
      status: processed > 0 || failure.outcomeAmbiguous ? 'partial_failure' : 'failed',
      ...common,
      failure,
    });
  }

  const hasSyncWarning = Boolean(
    readbackError
    || updateError
    || recoveryWarnings.length > 0
    || metadataWarnings.length > 0
  );

  if (created === 0) {
    return freezeResult({
      status: hasSyncWarning ? 'replayed_with_sync_warning' : 'replayed',
      ...common,
      failure: null,
    });
  }

  return freezeResult({
    status: hasSyncWarning ? 'committed_with_sync_warning' : 'committed',
    ...common,
    failure: null,
  });
};

export const __test = Object.freeze({
  sourceReferenceForEntry,
  committedReceiptItem,
  failedReceiptItem,
});
