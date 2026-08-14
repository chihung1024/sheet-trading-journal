import {
  pendingCalculationMatchesBenchmark,
  readPendingCalculationRequest,
} from './calculationJobState.js';
import { triageCalculationFailure } from './calculationFailureRecovery.js';
import { subscribeRequestFailure } from './requestFailureSignal.js';
import { markRequestOutcome } from './requestErrors.js';

export const TRIGGER_AMBIGUITY_REPLAY_DELAY_MS = 1_500;
const TRIGGER_PATH = '/api/trigger-update';

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const normalizeBenchmark = value => (
  typeof value === 'string' ? value.trim().toUpperCase() : ''
);

const wait = (delayMs, setTimeoutImpl) => new Promise(resolve => {
  setTimeoutImpl(resolve, delayMs);
});

export const installCalculationTriggerAmbiguityRecovery = ({
  portfolio,
  auth,
  storage,
  notify = () => {},
  retryDelayMs = TRIGGER_AMBIGUITY_REPLAY_DELAY_MS,
  setTimeoutImpl = setTimeout,
  subscribe = subscribeRequestFailure,
} = {}) => {
  if (!portfolio || !auth || !storage) {
    throw new TypeError('Trigger ambiguity recovery requires portfolio, auth, and storage');
  }
  if (typeof portfolio.triggerUpdate !== 'function') {
    throw new TypeError('Trigger ambiguity recovery requires portfolio.triggerUpdate');
  }
  if (typeof subscribe !== 'function' || typeof setTimeoutImpl !== 'function') {
    throw new TypeError('Trigger ambiguity recovery dependencies are invalid');
  }

  let stopped = false;
  const attemptedKeys = new Set();

  const handleFailure = async (event) => {
    if (
      event?.pathname !== TRIGGER_PATH
      || String(event?.method || '').toUpperCase() !== 'POST'
      || stopped
    ) {
      return;
    }

    let contextualError;
    try {
      contextualError = markRequestOutcome(event.error, 'POST');
    } catch {
      return;
    }
    const triage = triageCalculationFailure({
      errorCode: contextualError?.apiCode || '',
      source: 'trigger',
      outcomeAmbiguous: contextualError?.outcomeAmbiguous === true,
    });
    if (!triage.retryable) return;

    const owner = normalizeOwner(auth.user?.email);
    if (!owner) return;

    let pending;
    try {
      pending = readPendingCalculationRequest(storage, owner);
    } catch {
      return;
    }
    if (!pending?.key || attemptedKeys.has(pending.key)) return;

    const benchmark = normalizeBenchmark(
      pending.benchmark || portfolio.selectedBenchmark,
    );
    if (!benchmark || !pendingCalculationMatchesBenchmark(pending, benchmark)) return;

    const key = pending.key;
    attemptedKeys.add(key);
    try {
      await wait(retryDelayMs, setTimeoutImpl);
    } catch {
      return;
    }
    if (stopped) return;

    const currentOwner = normalizeOwner(auth.user?.email);
    if (currentOwner !== owner) return;
    if (normalizeBenchmark(portfolio.selectedBenchmark) !== benchmark) return;

    let currentPending;
    try {
      currentPending = readPendingCalculationRequest(storage, owner);
    } catch {
      return;
    }
    if (
      !currentPending
      || currentPending.key !== key
      || !pendingCalculationMatchesBenchmark(currentPending, benchmark)
    ) {
      return;
    }

    notify('更新要求回應不確定，正在以相同識別碼安全確認原計算工作', 'info');
    try {
      await portfolio.triggerUpdate(benchmark, {
        automatic: true,
        ambiguityReplay: true,
      });
    } catch {
      notify('原計算工作仍無法安全確認；已保留待處理狀態，稍後重新整理可繼續恢復', 'warning');
    }
  };

  const unsubscribe = subscribe(event => {
    void handleFailure(event).catch(() => {});
  });

  return () => {
    stopped = true;
    attemptedKeys.clear();
    if (typeof unsubscribe === 'function') unsubscribe();
  };
};
