import { readEligibleRecordCreateIntents } from './recordCreateIntent.js';

export const IMPORT_AMBIGUOUS_RETRY_REASON = Object.freeze({
  NOT_AMBIGUOUS: 'not_ambiguous',
  RECONCILIATION_PENDING: 'reconciliation_pending',
  RECOVERY_STATE_UNAVAILABLE: 'recovery_state_unavailable',
});

export const isAmbiguousImportRetryCandidate = result => Boolean(
  result
  && typeof result === 'object'
  && !Array.isArray(result)
  && result.status === 'partial_failure'
  && result.failure?.outcomeAmbiguous === true
);

const validateStableEntries = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('Ambiguous import retry requires validated import entries');
  }
  if (entries.some(entry => typeof entry?.idempotencyKey !== 'string' || !entry.idempotencyKey)) {
    throw new TypeError('Ambiguous import retry requires stable entry idempotency keys');
  }
  return entries.length;
};

const retryGateResult = (ready, reason = null, reconciliationDegraded = false) => Object.freeze({
  ready,
  reason,
  reconciliation_degraded: reconciliationDegraded,
});

export const prepareAmbiguousImportRetry = async (
  importResult,
  {
    entries,
    storage = globalThis.localStorage,
    owner,
    reconcile,
    readPendingIntents = readEligibleRecordCreateIntents,
  } = {},
) => {
  if (!isAmbiguousImportRetryCandidate(importResult)) {
    return retryGateResult(false, IMPORT_AMBIGUOUS_RETRY_REASON.NOT_AMBIGUOUS);
  }
  if (typeof owner !== 'string' || !owner.trim()) {
    throw new TypeError('Ambiguous import retry requires a signed owner');
  }
  if (typeof reconcile !== 'function' || typeof readPendingIntents !== 'function') {
    throw new TypeError('Ambiguous import retry reconciliation dependencies are invalid');
  }

  validateStableEntries(entries);
  let reconciliationDegraded = false;
  try {
    await reconcile();
  } catch {
    // Existing recovery can settle the ambiguous intent before a later readback
    // failure. Durable recovery state below is therefore the final retry gate.
    reconciliationDegraded = true;
  }

  let pending;
  try {
    pending = readPendingIntents(storage, owner, { limit: 1 });
  } catch {
    return retryGateResult(
      false,
      IMPORT_AMBIGUOUS_RETRY_REASON.RECOVERY_STATE_UNAVAILABLE,
      reconciliationDegraded,
    );
  }

  // Importers do not all expose the same key representation to the UI. IBKR,
  // for example, hashes its import identity before persisting the durable
  // record-create intent. The record-create mutation barrier guarantees at most
  // one eligible intent per owner, so any remaining eligible create recovery is
  // a fail-closed reason to delay whole-batch replay rather than compare unlike
  // key formats and risk racing recovery.
  if (Array.isArray(pending) && pending.length > 0) {
    return retryGateResult(
      false,
      IMPORT_AMBIGUOUS_RETRY_REASON.RECONCILIATION_PENDING,
      reconciliationDegraded,
    );
  }

  return retryGateResult(true, null, reconciliationDegraded);
};

export const __test = Object.freeze({
  validateStableEntries,
});
