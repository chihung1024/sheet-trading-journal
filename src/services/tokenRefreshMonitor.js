import { getJwtSecondsUntilExpiry } from './jwtClaims.js';

export const TOKEN_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const TOKEN_REFRESH_THRESHOLD_SECONDS = 10 * 60;

const normalizeLogger = (logger) => (
    logger && (typeof logger === 'object' || typeof logger === 'function')
        ? logger
        : {}
);

export const createTokenRefreshMonitor = ({
    getToken,
    refreshToken,
    checkIntervalMs = TOKEN_CHECK_INTERVAL_MS,
    refreshThresholdSeconds = TOKEN_REFRESH_THRESHOLD_SECONDS,
    nowMs = () => Date.now(),
    getSecondsUntilExpiry = (token, currentTime) => getJwtSecondsUntilExpiry(token, {
        nowMs: currentTime,
    }),
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    logger = console,
} = {}) => {
    if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
    if (typeof refreshToken !== 'function') throw new TypeError('refreshToken must be a function');
    if (!Number.isFinite(checkIntervalMs) || checkIntervalMs <= 0) {
        throw new TypeError('checkIntervalMs must be a finite positive number');
    }
    if (!Number.isFinite(refreshThresholdSeconds) || refreshThresholdSeconds < 0) {
        throw new TypeError('refreshThresholdSeconds must be finite and non-negative');
    }
    if (typeof nowMs !== 'function' || typeof getSecondsUntilExpiry !== 'function') {
        throw new TypeError('token time providers must be functions');
    }
    if (typeof setIntervalImpl !== 'function' || typeof clearIntervalImpl !== 'function') {
        throw new TypeError('interval implementation is unavailable');
    }

    const safeLogger = normalizeLogger(logger);
    let timerId = null;
    let checkPromise = null;
    let lifecycleEpoch = 0;

    const checkAndRefresh = () => {
        if (checkPromise) return checkPromise;

        const observedEpoch = lifecycleEpoch;
        let trackedPromise;
        const operation = Promise.resolve().then(async () => {
            if (observedEpoch !== lifecycleEpoch) return false;

            const observedToken = getToken();
            if (!observedToken) return false;

            try {
                const secondsRemaining = getSecondsUntilExpiry(observedToken, nowMs());
                safeLogger.log?.(
                    `[Token refresh] Token remaining: ${Math.floor(secondsRemaining / 60)} minutes`,
                );
                if (secondsRemaining < refreshThresholdSeconds) {
                    if (
                        observedEpoch !== lifecycleEpoch
                        || getToken() !== observedToken
                    ) return false;
                    return (await refreshToken()) === true;
                }
                return observedEpoch === lifecycleEpoch;
            } catch (error) {
                safeLogger.error?.('[Token refresh] Token check failed', error);
                return false;
            }
        });

        trackedPromise = operation.finally(() => {
            if (checkPromise === trackedPromise) checkPromise = null;
        });
        checkPromise = trackedPromise;
        return trackedPromise;
    };

    const start = () => {
        if (timerId !== null || !getToken()) return false;
        lifecycleEpoch += 1;
        timerId = setIntervalImpl(() => {
            void checkAndRefresh();
        }, checkIntervalMs);
        void checkAndRefresh();
        return true;
    };

    const stop = () => {
        const wasRunning = timerId !== null;
        lifecycleEpoch += 1;
        if (wasRunning) {
            clearIntervalImpl(timerId);
            timerId = null;
        }
        return wasRunning;
    };

    const syncToken = (token) => {
        if (token) return start();
        stop();
        return false;
    };

    const isRunning = () => timerId !== null;
    const isChecking = () => checkPromise !== null;

    return {
        checkAndRefresh,
        start,
        stop,
        syncToken,
        isRunning,
        isChecking,
    };
};
