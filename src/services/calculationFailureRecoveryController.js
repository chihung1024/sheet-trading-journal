import { watch } from 'vue';
import { readAutomaticRecalculationStatus } from './automaticRecalculationState.js';
import {
  claimAutomaticFailureRetry,
  FAILURE_RECOVERY_CLASS,
  triageCalculationFailure,
} from './calculationFailureRecovery.js';

export const CALCULATION_FAILURE_RETRY_DELAY_MS = 5_000;

const normalizeOwner = value => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const wait = (delayMs, setTimeoutImpl) => new Promise(resolve => {
  setTimeoutImpl(resolve, delayMs);
});

const failureMessage = triage => {
  switch (triage.classification) {
    case FAILURE_RECOVERY_CLASS.RETRYABLE_TRANSIENT:
      return '偵測到暫時性計算服務異常，系統將自動安全重試一次';
    case FAILURE_RECOVERY_CLASS.USER_ACTION_REQUIRED:
      return '交易資料未通過計算前驗證，已停止自動重試；請檢查交易紀錄';
    case FAILURE_RECOVERY_CLASS.INTEGRITY_STOP:
      return '資料一致性檢查未通過，已停止自動重試並保留既有快照';
    case FAILURE_RECOVERY_CLASS.OPERATIONS_STOP:
      return '更新服務設定異常，已停止自動重試';
    default:
      return '計算失敗且不符合安全自動重試條件，已保留既有快照';
  }
};

export const installCalculationFailureRecovery = ({
  portfolio,
  auth,
  storage,
  notify = () => {},
  retryDelayMs = CALCULATION_FAILURE_RETRY_DELAY_MS,
  setTimeoutImpl = setTimeout,
} = {}) => {
  if (!portfolio || !auth || !storage) {
    throw new TypeError('Failure recovery controller requires portfolio, auth, and storage');
  }
  if (typeof portfolio.triggerUpdate !== 'function') {
    throw new TypeError('Failure recovery controller requires portfolio.triggerUpdate');
  }

  let stopped = false;
  let lastHandledFailure = '';

  const handleFailure = async (job) => {
    const signature = `${job?.id || ''}|${job?.status || ''}|${job?.error_code || ''}`;
    if (!job?.id || job.status !== 'failed' || signature === lastHandledFailure) return;
    lastHandledFailure = signature;

    const triage = triageCalculationFailure({
      errorCode: job.error_code || 'UNKNOWN_CALCULATION_FAILED',
      source: 'job',
    });

    let automaticStatus;
    const owner = normalizeOwner(auth.user?.email);
    try {
      automaticStatus = readAutomaticRecalculationStatus(storage, owner);
    } catch {
      notify(failureMessage(triage), triage.retryable ? 'warning' : 'error');
      return;
    }

    const generation = automaticStatus?.dirty ? automaticStatus.generation : null;
    if (!triage.retryable || !generation) {
      notify(failureMessage(triage), triage.retryable ? 'warning' : 'error');
      return;
    }

    let claimed = false;
    try {
      claimed = claimAutomaticFailureRetry(
        storage,
        owner,
        generation.token,
        triage,
      );
    } catch {
      claimed = false;
    }
    if (!claimed) {
      notify('暫時性計算異常已達自動重試上限，已保留既有快照', 'warning');
      return;
    }

    notify(failureMessage(triage), 'warning');
    await wait(retryDelayMs, setTimeoutImpl);
    if (stopped) return;

    const currentOwner = normalizeOwner(auth.user?.email);
    if (!currentOwner || currentOwner !== owner) return;

    let currentStatus;
    try {
      currentStatus = readAutomaticRecalculationStatus(storage, owner);
    } catch {
      return;
    }
    if (
      !currentStatus.dirty
      || currentStatus.generation?.token !== generation.token
    ) {
      return;
    }

    const activeJob = portfolio.calculationJob;
    if (activeJob?.status === 'queued' || activeJob?.status === 'running') return;

    try {
      await portfolio.triggerUpdate(portfolio.selectedBenchmark || generation.benchmark, {
        automatic: true,
      });
    } catch {
      notify('自動重試仍未成功；已停止重試並保留待重算狀態', 'warning');
    }
  };

  const stopWatch = watch(
    () => portfolio.calculationJob,
    job => {
      if (job?.status === 'failed') void handleFailure(job);
    },
    { deep: false },
  );

  return () => {
    stopped = true;
    if (typeof stopWatch === 'function') stopWatch();
  };
};
