export const GOOGLE_REFRESH_TIMEOUT_MS = 10_000;

const hasGoogleIdentity = (googleIdentity) => (
    googleIdentity
    && typeof googleIdentity.initialize === 'function'
    && typeof googleIdentity.prompt === 'function'
);

const normalizeLogger = (logger) => (
    logger && (typeof logger === 'object' || typeof logger === 'function')
        ? logger
        : {}
);

export const createGoogleCredentialRefreshController = ({
    getGoogleIdentity = () => globalThis.window?.google?.accounts?.id,
    clientId,
    exchangeCredential,
    timeoutMs = GOOGLE_REFRESH_TIMEOUT_MS,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    logger = console,
} = {}) => {
    if (typeof getGoogleIdentity !== 'function') {
        throw new TypeError('getGoogleIdentity must be a function');
    }
    if (typeof clientId !== 'string' || !clientId.trim()) {
        throw new TypeError('Google client ID is required');
    }
    if (typeof exchangeCredential !== 'function') {
        throw new TypeError('exchangeCredential must be a function');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TypeError('refresh timeout must be a finite positive number');
    }
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
        throw new TypeError('refresh timer implementation is unavailable');
    }

    const safeLogger = normalizeLogger(logger);
    let inFlightPromise = null;
    let cancelCurrent = null;

    const refresh = () => {
        if (inFlightPromise) return inFlightPromise;

        let trackedPromise;
        const operation = new Promise((resolve) => {
            let googleIdentity;
            try {
                googleIdentity = getGoogleIdentity();
            } catch (error) {
                safeLogger.error?.('[Token refresh] Google Identity lookup failed', error);
                resolve(false);
                return;
            }
            if (!hasGoogleIdentity(googleIdentity)) {
                resolve(false);
                return;
            }

            let settled = false;
            let credentialReceived = false;
            let timeoutId = null;
            const controller = new AbortController();

            const settle = (result, { abort = result !== true } = {}) => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) {
                    clearTimeoutImpl(timeoutId);
                    timeoutId = null;
                }
                if (abort && !controller.signal.aborted) controller.abort('refresh-settled');
                resolve(result === true);
            };

            cancelCurrent = () => settle(false, { abort: true });

            try {
                timeoutId = setTimeoutImpl(() => settle(false, { abort: true }), timeoutMs);

                googleIdentity.initialize({
                    client_id: clientId,
                    callback: async (response) => {
                        if (settled || credentialReceived) return;
                        credentialReceived = true;

                        const credential = response?.credential;
                        if (typeof credential !== 'string' || !credential.trim()) {
                            safeLogger.warn?.('[Token refresh] Google returned no credential');
                            settle(false, { abort: true });
                            return;
                        }
                        try {
                            const exchanged = await exchangeCredential(credential, {
                                signal: controller.signal,
                            });
                            settle(exchanged === true, { abort: exchanged !== true });
                        } catch (error) {
                            if (!settled) {
                                safeLogger.error?.('[Token refresh] Credential exchange failed', error);
                            }
                            settle(false, { abort: true });
                        }
                    },
                    auto_select: true,
                    cancel_on_tap_outside: false,
                });

                googleIdentity.prompt((notification) => {
                    if (settled || credentialReceived) return;
                    try {
                        const unavailable = notification?.isNotDisplayed?.() === true;
                        const skipped = notification?.isSkippedMoment?.() === true;
                        const dismissed = notification?.isDismissedMoment?.() === true;
                        if (unavailable || skipped || dismissed) {
                            settle(false, { abort: true });
                        }
                    } catch (error) {
                        safeLogger.error?.('[Token refresh] Prompt notification failed', error);
                        settle(false, { abort: true });
                    }
                });
            } catch (error) {
                safeLogger.error?.('[Token refresh] Google Identity initialization failed', error);
                settle(false, { abort: true });
            }
        });

        trackedPromise = operation.finally(() => {
            if (inFlightPromise === trackedPromise) inFlightPromise = null;
            cancelCurrent = null;
        });
        inFlightPromise = trackedPromise;
        return trackedPromise;
    };

    const cancel = () => {
        cancelCurrent?.();
    };

    const isRefreshing = () => inFlightPromise !== null;

    return {
        refresh,
        cancel,
        isRefreshing,
    };
};
