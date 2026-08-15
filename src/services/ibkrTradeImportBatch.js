const requireFunction = (value, label) => {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
};

const freezeResult = value => Object.freeze({
  ...value,
  failure: value.failure ? Object.freeze(value.failure) : null,
  sync: Object.freeze({
    ...value.sync,
    recoveryWarnings: Object.freeze(value.sync.recoveryWarnings || []),
  }),
});

export const runIbkrTradeImportBatch = async (
  entries,
  {
    createRecord,
    refreshRecords,
    requestUpdate,
  } = {},
) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('At least one validated IBKR import entry is required');
  }
  const create = requireFunction(createRecord, 'createRecord');
  const refresh = requireFunction(refreshRecords, 'refreshRecords');
  const update = requireFunction(requestUpdate, 'requestUpdate');

  let processed = 0;
  let created = 0;
  let replayed = 0;
  let failure = null;
  const recoveryWarnings = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    try {
      const outcome = await create(entry, index);
      if (outcome?.committed !== true) {
        const error = outcome?.error || new Error('IBKR record create was not confirmed');
        error.outcomeAmbiguous = outcome?.outcomeAmbiguous === true;
        throw error;
      }
      processed += 1;
      if (outcome.deduplicated === true) replayed += 1;
      else created += 1;
      if (outcome.recoveryStateError) {
        recoveryWarnings.push(Object.freeze({
          index,
          entry,
          error: outcome.recoveryStateError,
          deduplicated: outcome.deduplicated === true,
        }));
      }
    } catch (error) {
      failure = {
        index,
        entry,
        error,
        outcomeAmbiguous: error?.outcomeAmbiguous === true,
      };
      break;
    }
  }

  // A server-side replay is already authoritative evidence that the same tenant/key/payload
  // exists. Do not replace the current records array for a replay-only batch: snapshot
  // verification is deliberately bound to the exact records array and a no-op import must
  // not invalidate that proof. Read back only when the ledger actually changed or may have.
  const ledgerMayHaveChanged = created > 0 || failure?.outcomeAmbiguous === true;
  const shouldRefresh = ledgerMayHaveChanged;
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
  };

  if (failure) {
    return freezeResult({
      status: processed > 0 || failure.outcomeAmbiguous ? 'partial_failure' : 'failed',
      total: entries.length,
      processed,
      created,
      replayed,
      failure,
      sync,
    });
  }

  const hasSyncWarning = Boolean(readbackError || updateError || recoveryWarnings.length > 0);

  if (created === 0) {
    return freezeResult({
      status: hasSyncWarning ? 'replayed_with_sync_warning' : 'replayed',
      total: entries.length,
      processed,
      created,
      replayed,
      failure: null,
      sync,
    });
  }

  return freezeResult({
    status: hasSyncWarning ? 'committed_with_sync_warning' : 'committed',
    total: entries.length,
    processed,
    created,
    replayed,
    failure: null,
    sync,
  });
};
