import { subscribeRequestFailure } from './requestFailureSignal.js';
import { markRequestOutcome } from './requestErrors.js';
import {
  markRecordCreateIntentReconciling,
  readEligibleRecordCreateIntents,
} from './recordCreateIntent.js';

export const RECORD_CREATE_RECONCILIATION_DELAY_MS = 750;
const RECORD_CREATE_PATH = '/api/records/idempotent';

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const wait = (delayMs, setTimeoutImpl) => new Promise(resolve => {
  setTimeoutImpl(resolve, delayMs);
});

const safeNotify = (notify, message, level) => {
  try {
    notify(message, level);
  } catch {
    // Recovery presentation must never alter mutation semantics.
  }
};

export const installRecordCreateAmbiguityRecovery = ({
  portfolio,
  auth,
  storage,
  notify = () => {},
  retryDelayMs = RECORD_CREATE_RECONCILIATION_DELAY_MS,
  setTimeoutImpl = setTimeout,
  subscribe = subscribeRequestFailure,
} = {}) => {
  if (!portfolio || !auth || !storage) {
    throw new TypeError('Record-create ambiguity recovery requires portfolio, auth, and storage');
  }
  if (typeof portfolio.fetchAll !== 'function') {
    throw new TypeError('Record-create ambiguity recovery requires portfolio.fetchAll');
  }
  if (typeof subscribe !== 'function' || typeof setTimeoutImpl !== 'function') {
    throw new TypeError('Record-create ambiguity recovery dependencies are invalid');
  }

  let stopped = false;
  const attemptedKeys = new Set();

  const handleFailure = async (event) => {
    if (
      stopped
      || event?.pathname !== RECORD_CREATE_PATH
      || String(event?.method || '').toUpperCase() !== 'POST'
    ) {
      return;
    }

    const contextualError = markRequestOutcome(event.error, 'POST');
    if (contextualError?.outcomeAmbiguous !== true) return;

    const owner = normalizeOwner(auth.user?.email);
    if (!owner || !auth.token) return;

    let intent;
    try {
      [intent] = readEligibleRecordCreateIntents(storage, owner);
    } catch {
      return;
    }
    if (!intent?.idempotencyKey || attemptedKeys.has(intent.idempotencyKey)) return;

    try {
      const reconciling = markRecordCreateIntentReconciling(
        storage,
        owner,
        intent.idempotencyKey,
      );
      if (!reconciling) return;
    } catch {
      return;
    }

    const key = intent.idempotencyKey;
    attemptedKeys.add(key);
    safeNotify(notify, '新增交易回應不確定，系統正在用原識別碼自動確認，請勿重複送出相同交易', 'info');

    try {
      await wait(retryDelayMs, setTimeoutImpl);
      if (stopped) return;
      if (normalizeOwner(auth.user?.email) !== owner || !auth.token) return;

      let currentIntent;
      try {
        [currentIntent] = readEligibleRecordCreateIntents(storage, owner);
      } catch {
        return;
      }
      if (currentIntent?.idempotencyKey !== key) return;

      try {
        await portfolio.fetchAll();
      } catch {
        // fetchAll/recovery owns its own durable error state and later reload path.
      }

      let stillPending = false;
      try {
        stillPending = readEligibleRecordCreateIntents(storage, owner)
          .some(candidate => candidate.idempotencyKey === key);
      } catch {
        stillPending = true;
      }
      if (stillPending) {
        safeNotify(
          notify,
          '新增交易仍無法自動確認；已保留安全恢復狀態，請勿重複送出相同交易',
          'warning',
        );
      }
    } catch {
      // Recovery helpers are fail-closed; original durable intent remains authoritative.
    }
  };

  const unsubscribe = subscribe(event => {
    Promise.resolve(handleFailure(event)).catch(() => {});
  });

  return () => {
    stopped = true;
    attemptedKeys.clear();
    if (typeof unsubscribe === 'function') unsubscribe();
  };
};
