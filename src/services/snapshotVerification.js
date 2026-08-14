import { ref } from 'vue';

// Phase 3 already proves snapshot/source identity cryptographically. Keep the
// resulting UI authorization in memory only: the proof is valid only for the exact
// snapshot object and records array that were assessed together.
let verifiedSnapshot = null;
let verifiedRecords = null;
const verificationGeneration = ref(0);

export const publishSnapshotVerification = (snapshot, records) => {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(records)) return false;
  verifiedSnapshot = snapshot;
  verifiedRecords = records;
  verificationGeneration.value += 1;
  return true;
};

export const isSnapshotVerificationCurrent = (snapshot, records) => {
  // Reading the generation makes consumers reactive when Phase 3 publishes a fresh
  // proof, without introducing persistent state or another lifecycle controller.
  void verificationGeneration.value;
  return Boolean(
    snapshot
    && typeof snapshot === 'object'
    && Array.isArray(records)
    && snapshot === verifiedSnapshot
    && records === verifiedRecords
  );
};
