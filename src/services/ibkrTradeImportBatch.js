const requireFunction = (value, label) => {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
};

const freezeResult = value => Object.freeze({
  ...value,
  failure: value.failure ? Object.freeze(value.failure) : null,
  sync: Object.freeze(value.sync),
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

  const ledgerMayHaveChanged = created > 0 || failure?.outcomeAmbiguous === true;
  const shouldRefresh = processed > 0 || ledgerMayHaveChanged;
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

  if (created === 0) {
    return freezeResult({
      status: readbackError ? 'replayed_with_sync_warning' : 'replayed',
      total: entries.length,
      processed,
      created,
      replayed,
      failure: null,
      sync,
    });
  }

  return freezeResult({
    status: readbackError || updateError ? 'committed_with_sync_warning' : 'committed',
    total: entries.length,
    processed,
    created,
    replayed,
    failure: null,
    sync,
  });
};
