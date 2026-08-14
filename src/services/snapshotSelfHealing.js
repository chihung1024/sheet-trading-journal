import { watch } from 'vue';

import {
  markAutomaticRecalculationDirty,
  readAutomaticRecalculationStatus,
} from './automaticRecalculationState.js';
import {
  assessSnapshotIntegrity,
  SNAPSHOT_INTEGRITY_STATUS,
} from './snapshotIntegrity.js';

const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

export const createSnapshotRepairTracker = () => new Set();

export const reconcileSnapshotSelfHealing = async ({
  portfolio,
  auth,
  storage,
  attemptedFingerprints,
}) => {
  if (portfolio?.portfolioReadStatus !== 'loaded') {
    return Object.freeze({ action: 'not_ready', assessment: null });
  }

  const owner = normalizeOwner(auth?.user?.email);
  if (!owner) {
    return Object.freeze({ action: 'no_owner', assessment: null });
  }

  const assessment = await assessSnapshotIntegrity(
    portfolio.records,
    portfolio.rawData,
    { expectedBenchmark: portfolio.selectedBenchmark },
  );

  if (
    assessment.status === SNAPSHOT_INTEGRITY_STATUS.FRESH
    || assessment.status === SNAPSHOT_INTEGRITY_STATUS.EMPTY
  ) {
    return Object.freeze({ action: 'verified', assessment });
  }

  if (typeof portfolio.markSnapshotStale === 'function') {
    portfolio.markSnapshotStale();
  }

  if (!assessment.repairNeeded) {
    console.warn('Snapshot integrity cannot be verified safely; automatic repair is disabled', {
      status: assessment.status,
      fingerprint: assessment.fingerprint,
    });
    return Object.freeze({ action: 'fail_closed', assessment });
  }

  const tracker = attemptedFingerprints || createSnapshotRepairTracker();
  if (tracker.has(assessment.fingerprint)) {
    return Object.freeze({ action: 'already_attempted', assessment });
  }
  tracker.add(assessment.fingerprint);

  let automaticStatus;
  try {
    automaticStatus = readAutomaticRecalculationStatus(storage, owner);
  } catch (error) {
    console.warn('Snapshot repair cannot read Phase 2 recovery state', error);
    return Object.freeze({ action: 'repair_state_unavailable', assessment });
  }

  if (automaticStatus.dirty) {
    return Object.freeze({ action: 'phase2_already_dirty', assessment });
  }

  try {
    markAutomaticRecalculationDirty(
      storage,
      owner,
      portfolio.selectedBenchmark || assessment.manifestBenchmark || 'SPY',
    );
  } catch (error) {
    console.warn('Snapshot repair cannot persist Phase 2 dirty generation', error);
    return Object.freeze({ action: 'repair_state_unavailable', assessment });
  }

  // The loaded transition can fire before createSingleFlight has released the
  // just-finished fetchAll promise. Yield one task so this call is guaranteed
  // to start a fresh full read. performFetchAll then hands the durable dirty
  // generation to the already-reviewed Phase 2 debounce/active-lane logic.
  await nextTask();
  try {
    await portfolio.fetchAll();
    return Object.freeze({ action: 'repair_handed_to_phase2', assessment });
  } catch (error) {
    console.warn('Snapshot repair handoff refresh failed; durable dirty state is retained', error);
    return Object.freeze({ action: 'repair_handoff_failed', assessment });
  }
};

export const installSnapshotSelfHealing = ({
  portfolio,
  auth,
  storage = globalThis.localStorage,
} = {}) => {
  if (!portfolio || !auth || !storage) return () => {};

  const attemptedFingerprints = createSnapshotRepairTracker();
  const attemptedTerminalDirtyTokens = new Set();
  let reconciliationPromise = null;
  let rerunRequested = false;
  let scheduledTerminalDirtyToken = null;

  const readTerminalDirtyToken = () => {
    if (
      portfolio.portfolioReadStatus !== 'loaded'
      || portfolio.snapshotFreshness !== 'stale'
      || portfolio.loading
      || portfolio.calculationJob?.status !== 'succeeded'
    ) {
      return null;
    }

    const owner = normalizeOwner(auth?.user?.email);
    if (!owner) return null;
    try {
      const status = readAutomaticRecalculationStatus(storage, owner);
      return status.dirty ? status.generation?.token || null : null;
    } catch (error) {
      console.warn('Snapshot terminal handoff cannot read Phase 2 recovery state', error);
      return null;
    }
  };

  const scheduleTerminalDirtyHandoff = () => {
    if (reconciliationPromise) return;
    const token = readTerminalDirtyToken();
    if (
      !token
      || scheduledTerminalDirtyToken === token
      || attemptedTerminalDirtyTokens.has(token)
    ) {
      return;
    }

    scheduledTerminalDirtyToken = token;
    setTimeout(() => {
      if (scheduledTerminalDirtyToken === token) scheduledTerminalDirtyToken = null;
      const currentToken = readTerminalDirtyToken();
      if (currentToken !== token || attemptedTerminalDirtyTokens.has(token)) return;

      // A successful calculation can finish while Phase 3 is creating a newer
      // dirty generation from the just-read snapshot. Re-entering the existing
      // full-read lifecycle after the active trigger stack has unwound gives
      // Phase 2 one deterministic chance to observe and schedule that durable
      // generation. No new retry authority or financial calculation is added.
      attemptedTerminalDirtyTokens.add(token);
      void portfolio.fetchAll().catch(error => {
        console.warn('Snapshot terminal dirty handoff refresh failed; durable dirty state is retained', error);
      });
    }, 0);
  };

  const run = () => {
    if (reconciliationPromise) {
      rerunRequested = true;
      return reconciliationPromise;
    }

    reconciliationPromise = (async () => {
      let result;
      do {
        rerunRequested = false;
        result = await reconcileSnapshotSelfHealing({
          portfolio,
          auth,
          storage,
          attemptedFingerprints,
        });
      } while (rerunRequested && portfolio.portfolioReadStatus === 'loaded');
      return result;
    })().finally(() => {
      reconciliationPromise = null;
      scheduleTerminalDirtyHandoff();
      if (rerunRequested && portfolio.portfolioReadStatus === 'loaded') void run();
    });
    return reconciliationPromise;
  };

  const stopReadWatch = watch(
    () => portfolio.portfolioReadStatus,
    status => {
      if (status === 'loaded') void run();
    },
    { flush: 'post' },
  );

  const stopTerminalHandoffWatch = watch(
    () => [
      portfolio.snapshotFreshness,
      portfolio.loading,
      portfolio.calculationJob?.status,
      portfolio.calculationJob?.id,
    ],
    () => scheduleTerminalDirtyHandoff(),
    { flush: 'post' },
  );

  return () => {
    stopReadWatch();
    stopTerminalHandoffWatch();
  };
};
