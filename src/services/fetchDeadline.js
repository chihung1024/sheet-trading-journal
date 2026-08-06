import {
    RequestAbortedError,
    RequestTimeoutError,
} from './requestErrors.js';

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const validateTimeout = (timeoutMs) => {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TypeError('timeoutMs must be a finite positive number');
    }
};

export const fetchWithDeadline = async (
    input,
    init = {},
    {
        timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
        signal = init.signal || null,
        fetchImpl = globalThis.fetch,
        setTimeoutImpl = globalThis.setTimeout,
        clearTimeoutImpl = globalThis.clearTimeout,
    } = {},
) => {
    validateTimeout(timeoutMs);
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is unavailable');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
        throw new TypeError('timer implementation is unavailable');
    }
    if (signal?.aborted) {
        throw new RequestAbortedError({ reason: signal.reason });
    }

    const controller = new AbortController();
    let timeoutId = null;
    let timedOut = false;
    let externallyAborted = false;
    let removeAbortListener = null;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeoutImpl(() => {
            timedOut = true;
            reject(new RequestTimeoutError(timeoutMs));
            controller.abort();
        }, timeoutMs);
    });

    const candidates = [
        Promise.resolve().then(() => fetchImpl(input, {
            ...init,
            signal: controller.signal,
        })),
        timeoutPromise,
    ];

    if (signal) {
        candidates.push(new Promise((_, reject) => {
            const onAbort = () => {
                externallyAborted = true;
                reject(new RequestAbortedError({ reason: signal.reason }));
                controller.abort(signal.reason);
            };
            signal.addEventListener('abort', onAbort, { once: true });
            removeAbortListener = () => signal.removeEventListener('abort', onAbort);
        }));
    }

    try {
        return await Promise.race(candidates);
    } catch (error) {
        if (error instanceof RequestTimeoutError || error instanceof RequestAbortedError) throw error;
        if (timedOut) throw new RequestTimeoutError(timeoutMs, { cause: error });
        if (externallyAborted || signal?.aborted) {
            throw new RequestAbortedError({ cause: error, reason: signal?.reason });
        }
        throw error;
    } finally {
        if (timeoutId !== null) clearTimeoutImpl(timeoutId);
        removeAbortListener?.();
    }
};
