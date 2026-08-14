import { watch } from 'vue';
import { subscribeRequestFailure } from './requestFailureSignal.js';
import {
  ApiHttpError,
  MalformedApiResponseError,
  RequestAbortedError,
  RequestTimeoutError,
} from './requestErrors.js';

export const DATA_READ_SELF_RECOVERY_DELAY_MS = 2_000;

const RECOVERABLE_READ_PATHS = new Set([
  '/api/records',
  '/api/portfolio',
  '/api/user-settings',
]);

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
    // Recovery UX callbacks must never alter request/recovery semantics.
  }
};

export const isRetryableDataReadFailure = ({
  pathname = '',
  method = '',
  error,
} = {}) => {
  if (String(method).toUpperCase() !== 'GET') return false;
  if (!RECOVERABLE_READ_PATHS.has(pathname)) return false;
  if (error instanceof RequestAbortedError || error?.name === 'AbortError') return false;
  if (error instanceof RequestTimeoutError || error instanceof MalformedApiResponseError) return true;
  if (error instanceof ApiHttpError) {
    return Number.isFinite(error.status) && error.status >= 500;
  }
  if (error instanceof TypeError || error?.name === 'NetworkError') return true;
  return false;
};

export const installDataReadSelfRecovery = ({
  portfolio,
  auth,
  notify = () => {},
  retryDelayMs = DATA_READ_SELF_RECOVERY_DELAY_MS,
  setTimeoutImpl = setTimeout,
  subscribe = subscribeRequestFailure,
} = {}) => {
  if (!portfolio || !auth) {
    throw new TypeError('Data read self recovery requires portfolio and auth');
  }
  if (typeof portfolio.fetchAll !== 'function') {
    throw new TypeError('Data read self recovery requires portfolio.fetchAll');
  }
  if (typeof subscribe !== 'function' || typeof setTimeoutImpl !== 'function') {
    throw new TypeError('Data read self recovery dependencies are invalid');
  }

  let stopped = false;
  let episodeOwner = normalizeOwner(auth.user?.email);
  let attemptedForEpisode = false;
  let pendingFailure = null;
  let scheduled = false;

  const resetEpisodeForOwner = owner => {
    episodeOwner = normalizeOwner(owner);
    attemptedForEpisode = false;
    pendingFailure = null;
  };

  const scheduleIfNeeded = () => {
    const owner = normalizeOwner(auth.user?.email);
    if (owner !== episodeOwner) resetEpisodeForOwner(owner);
    if (
      stopped
      || scheduled
      || attemptedForEpisode
      || !pendingFailure
      || pendingFailure.owner !== owner
      || portfolio.portfolioReadStatus !== 'error'
    ) {
      return;
    }

    attemptedForEpisode = true;
    scheduled = true;
    const failure = pendingFailure;
    pendingFailure = null;

    void (async () => {
      try {
        await wait(retryDelayMs, setTimeoutImpl);
        if (stopped || portfolio.portfolioReadStatus !== 'error') return;

        const currentOwner = normalizeOwner(auth.user?.email);
        if (!currentOwner || currentOwner !== failure.owner || !auth.token) return;
        if (globalThis.navigator?.onLine === false) return;

        safeNotify(notify, '最新資料讀取暫時失敗，系統正在自動重新連線一次', 'info');
        try {
          await portfolio.fetchAll();
        } catch {
          safeNotify(notify, '自動重新連線仍未成功；可使用「重新載入」再次嘗試', 'warning');
        }
      } catch {
        // Timer/recovery helper failures are fail-closed and never escape globally.
      } finally {
        scheduled = false;
        if (!stopped && pendingFailure) scheduleIfNeeded();
      }
    })();
  };

  const unsubscribe = subscribe(event => {
    if (!isRetryableDataReadFailure(event) || stopped) return;
    const owner = normalizeOwner(auth.user?.email);
    if (!owner || !auth.token) return;
    if (owner !== episodeOwner) resetEpisodeForOwner(owner);
    pendingFailure = Object.freeze({ owner, pathname: event.pathname });
    scheduleIfNeeded();
  });

  const stopStatusWatch = watch(
    () => portfolio.portfolioReadStatus,
    status => {
      if (status === 'loaded') {
        attemptedForEpisode = false;
        pendingFailure = null;
        return;
      }
      if (status === 'error') scheduleIfNeeded();
    },
  );

  const stopOwnerWatch = watch(
    () => normalizeOwner(auth.user?.email),
    owner => {
      if (owner !== episodeOwner) resetEpisodeForOwner(owner);
    },
  );

  return () => {
    stopped = true;
    pendingFailure = null;
    if (typeof unsubscribe === 'function') unsubscribe();
    if (typeof stopStatusWatch === 'function') stopStatusWatch();
    if (typeof stopOwnerWatch === 'function') stopOwnerWatch();
  };
};
