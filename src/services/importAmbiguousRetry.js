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

const hasActiveReconciliation = (pending, now) => pending.some(intent => (
  Number.isFinite(intent?.reconcilingUntil)
  && intent.reconcilingUntil > now
));

export const prepareAmbiguousImportRetry = async (
  importResult,
  {
    entries,
    storage = globalThis.localStorage,
    owner,
    reconcile,
    readPendingIntents = readEligibleRecordCreateIntents,
    now = Date.now(),
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
  if (!Number.isFinite(now)) {
    throw new TypeError('Ambiguous import retry requires a finite reconciliation clock');
  }

  validateStableEntries(entries);
  let reconciliationDegraded = false;
  try {
    // fetchAll owns the existing same-key recovery and awaits that recovery before
    // its normal read path. The explicit retry must give that authority one full
    // opportunity before deciding whether it can take over.
    await reconcile();
  } catch {
    // Existing recovery runs before the later portfolio read. A later readback
    // failure therefore does not prove that recovery itself is still running.
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
  if (!Array.isArray(pending)) {
    return retryGateResult(
      false,
      IMPORT_AMBIGUOUS_RETRY_REASON.RECOVERY_STATE_UNAVAILABLE,
      reconciliationDegraded,
    );
  }

  // A live reconciliation window can belong to another tab/controller, so do
  // not race it. Once that bounded window has expired (or was never active), a
  // remaining live intent is recovery state, not proof of an in-flight request.
  // The existing mutation-barrier contract already allows a later *explicit*
  // mutation to supersede old recovery state. The parent importer will replay
  // only the exact re-prepared stable source, so allowing that explicit takeover
  // avoids permanently deadlocking the user after the one-shot automatic
  // recovery has already been exhausted.
  if (hasActiveReconciliation(pending, now)) {
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
  hasActiveReconciliation,
});
