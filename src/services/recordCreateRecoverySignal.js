const listeners = new Set();

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

export const publishRecordCreateRecoverySuccess = ({
  owner,
  body,
  recoveredAt = Date.now(),
} = {}) => {
  const normalizedOwner = normalizeOwner(owner);
  if (!normalizedOwner || typeof body !== 'string' || !body || !Number.isFinite(recoveredAt)) {
    return false;
  }

  const event = Object.freeze({
    owner: normalizedOwner,
    body,
    recoveredAt,
  });

  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // UI completion listeners must never alter authoritative recovery semantics.
    }
  }
  return true;
};

export const subscribeRecordCreateRecoverySuccess = (listener) => {
  if (typeof listener !== 'function') {
    throw new TypeError('Record-create recovery listener must be a function');
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
};
