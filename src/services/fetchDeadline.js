import {
    RequestAbortedError,
    RequestTimeoutError,
} from './requestErrors.js';
import { publishRequestFailure } from './requestFailureSignal.js';

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
        responseHandler = null,
        fetchImpl = globalThis.fetch,
        setTimeoutImpl = globalThis.setTimeout,
        clearTimeoutImpl = globalThis.clearTimeout,
    } = {},
) => {
    validateTimeout(timeoutMs);
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is unavailable');
    if (responseHandler !== null && typeof responseHandler !== 'function') {
        throw new TypeError('responseHandler must be a function or null');
    }
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

    const requestPromise = Promise.resolve().then(async () => {
        const response = await fetchImpl(input, {
            ...init,
            signal: controller.signal,
        });
        return responseHandler ? responseHandler(response) : response;
    });

    const candidates = [requestPromise, timeoutPromise];

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
        let normalizedError = error;
        if (error instanceof RequestTimeoutError || error instanceof RequestAbortedError) {
            normalizedError = error;
        } else if (timedOut) {
            normalizedError = new RequestTimeoutError(timeoutMs, { cause: error });
        } else if (externallyAborted || signal?.aborted) {
            normalizedError = new RequestAbortedError({ cause: error, reason: signal?.reason });
        }

        publishRequestFailure({
            input,
            init,
            error: normalizedError,
            externallyAborted,
        });
        throw normalizedError;
    } finally {
        if (timeoutId !== null) clearTimeoutImpl(timeoutId);
        removeAbortListener?.();
    }
};
