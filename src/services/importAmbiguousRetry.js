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

const validatedEntryKeys = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('Ambiguous import retry requires validated import entries');
  }
  const keys = entries.map(entry => entry?.idempotencyKey);
  if (keys.some(key => typeof key !== 'string' || !key)) {
    throw new TypeError('Ambiguous import retry requires stable entry idempotency keys');
  }
  return new Set(keys);
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

  const currentKeys = validatedEntryKeys(entries);
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

  if (
    Array.isArray(pending)
    && pending.some(intent => currentKeys.has(intent?.idempotencyKey))
  ) {
    return retryGateResult(
      false,
      IMPORT_AMBIGUOUS_RETRY_REASON.RECONCILIATION_PENDING,
      reconciliationDegraded,
    );
  }

  return retryGateResult(true, null, reconciliationDegraded);
};

export const __test = Object.freeze({
  validatedEntryKeys,
});
