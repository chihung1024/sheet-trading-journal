import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readApiJson } from '../src/services/apiResponse.js';
import {
    DEFAULT_REQUEST_TIMEOUT_MS,
    fetchWithDeadline,
} from '../src/services/fetchDeadline.js';
import {
    ApiApplicationError,
    ApiHttpError,
    MalformedApiResponseError,
    RequestAbortedError,
    RequestTimeoutError,
    formatRequestError,
    isExplicitServerRejection,
    markRequestOutcome,
} from '../src/services/requestErrors.js';

const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const createManualTimers = () => {
    let callback = null;
    const cleared = [];
    return {
        setTimeoutImpl(fn) {
            callback = fn;
            return 41;
        },
        clearTimeoutImpl(id) {
            cleared.push(id);
        },
        fire() {
            assert.equal(typeof callback, 'function');
            callback();
        },
        cleared,
    };
};

const response = ({ ok = true, status = 200, payload, jsonError = null } = {}) => ({
    ok,
    status,
    async json() {
        if (jsonError) throw jsonError;
        return payload;
    },
});

test('successful deadline request passes an internal signal and releases its timer', async () => {
    const timers = createManualTimers();
    let receivedSignal = null;
    const expected = { ok: true };

    const result = await fetchWithDeadline('/api/test', { method: 'GET' }, {
        timeoutMs: 250,
        fetchImpl: async (_input, init) => {
            receivedSignal = init.signal;
            return expected;
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    assert.equal(result, expected);
    assert.equal(receivedSignal instanceof AbortSignal, true);
    assert.equal(receivedSignal.aborted, false);
    assert.deepEqual(timers.cleared, [41]);
});

test('successful request removes an external abort listener', async () => {
    const timers = createManualTimers();
    const listeners = new Set();
    const externalSignal = {
        aborted: false,
        reason: undefined,
        addEventListener(type, listener) {
            assert.equal(type, 'abort');
            listeners.add(listener);
        },
        removeEventListener(type, listener) {
            assert.equal(type, 'abort');
            listeners.delete(listener);
        },
    };

    await fetchWithDeadline('/api/test', {}, {
        signal: externalSignal,
        fetchImpl: async () => ({ ok: true }),
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    assert.equal(listeners.size, 0);
    assert.deepEqual(timers.cleared, [41]);
});

test('deadline expiry aborts the fetch and returns a typed timeout', async () => {
    const timers = createManualTimers();
    let receivedSignal = null;
    const pending = fetchWithDeadline('/api/test', {}, {
        timeoutMs: 500,
        fetchImpl: (_input, init) => {
            receivedSignal = init.signal;
            return new Promise(() => {});
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    await flushMicrotasks();
    timers.fire();

    await assert.rejects(pending, (error) => {
        assert.equal(error instanceof RequestTimeoutError, true);
        assert.equal(error.code, 'REQUEST_TIMEOUT');
        assert.equal(error.timeoutMs, 500);
        return true;
    });
    assert.equal(receivedSignal.aborted, true);
    assert.deepEqual(timers.cleared, [41]);
});

test('deadline remains active while the response handler consumes the body', async () => {
    const timers = createManualTimers();
    let receivedSignal = null;
    let handlerStarted = false;
    const pending = fetchWithDeadline('/api/test', {}, {
        timeoutMs: 750,
        fetchImpl: async (_input, init) => {
            receivedSignal = init.signal;
            return response({ payload: { success: true } });
        },
        responseHandler: async () => {
            handlerStarted = true;
            return new Promise(() => {});
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    await flushMicrotasks();
    assert.equal(handlerStarted, true);
    timers.fire();

    await assert.rejects(pending, (error) => {
        assert.equal(error instanceof RequestTimeoutError, true);
        assert.equal(error.timeoutMs, 750);
        return true;
    });
    assert.equal(receivedSignal.aborted, true);
    assert.deepEqual(timers.cleared, [41]);
});

test('external abort is distinct, aborts the underlying fetch, and removes its listener', async () => {
    const timers = createManualTimers();
    const listeners = new Set();
    const externalSignal = {
        aborted: false,
        reason: undefined,
        addEventListener(type, listener) {
            assert.equal(type, 'abort');
            listeners.add(listener);
        },
        removeEventListener(type, listener) {
            assert.equal(type, 'abort');
            listeners.delete(listener);
        },
    };
    let receivedSignal = null;
    const pending = fetchWithDeadline('/api/test', {}, {
        timeoutMs: 500,
        signal: externalSignal,
        fetchImpl: (_input, init) => {
            receivedSignal = init.signal;
            return new Promise(() => {});
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    await flushMicrotasks();
    externalSignal.aborted = true;
    externalSignal.reason = 'navigation';
    for (const listener of [...listeners]) listener();

    await assert.rejects(pending, (error) => {
        assert.equal(error instanceof RequestAbortedError, true);
        assert.equal(error.code, 'REQUEST_ABORTED');
        assert.equal(error.reason, 'navigation');
        return true;
    });
    assert.equal(receivedSignal.aborted, true);
    assert.equal(listeners.size, 0);
    assert.deepEqual(timers.cleared, [41]);
});

test('already-aborted external signal rejects before fetch or timer creation', async () => {
    let fetchCalls = 0;
    let timerCalls = 0;
    const controller = new AbortController();
    controller.abort('already gone');

    await assert.rejects(
        fetchWithDeadline('/api/test', {}, {
            signal: controller.signal,
            fetchImpl: async () => {
                fetchCalls += 1;
            },
            setTimeoutImpl: () => {
                timerCalls += 1;
            },
        }),
        RequestAbortedError,
    );
    assert.equal(fetchCalls, 0);
    assert.equal(timerCalls, 0);
});

test('ordinary fetch failures pass through and still release the timer', async () => {
    const timers = createManualTimers();
    const failure = new TypeError('network down');

    await assert.rejects(
        fetchWithDeadline('/api/test', {}, {
            fetchImpl: async () => { throw failure; },
            setTimeoutImpl: timers.setTimeoutImpl,
            clearTimeoutImpl: timers.clearTimeoutImpl,
        }),
        (error) => error === failure,
    );
    assert.deepEqual(timers.cleared, [41]);
});

test('deadline service rejects invalid configuration', async () => {
    await assert.rejects(fetchWithDeadline('/api/test', {}, { timeoutMs: 0 }), TypeError);
    await assert.rejects(fetchWithDeadline('/api/test', {}, { timeoutMs: Number.NaN }), TypeError);
    await assert.rejects(fetchWithDeadline('/api/test', {}, { fetchImpl: null }), TypeError);
    await assert.rejects(fetchWithDeadline('/api/test', {}, { responseHandler: true }), TypeError);
    await assert.rejects(fetchWithDeadline('/api/test', {}, { setTimeoutImpl: null }), TypeError);
});

test('API parser returns successful object payloads', async () => {
    const payload = { success: true, data: { value: 1 } };
    assert.equal(await readApiJson(response({ payload }), { endpoint: '/api/test' }), payload);
});

test('API parser classifies HTTP failures and retains safe status/code', async () => {
    await assert.rejects(
        readApiJson(response({
            ok: false,
            status: 409,
            payload: { error: 'Conflict', error_meta: { code: 'REVISION_CONFLICT' } },
        })),
        (error) => {
            assert.equal(error instanceof ApiHttpError, true);
            assert.equal(error.status, 409);
            assert.equal(error.apiCode, 'REVISION_CONFLICT');
            assert.equal(error.message, 'Conflict');
            return true;
        },
    );
});

test('API parser maps malformed HTTP bodies to a status-only error', async () => {
    await assert.rejects(
        readApiJson(response({
            ok: false,
            status: 502,
            jsonError: new SyntaxError('bad json'),
        })),
        (error) => {
            assert.equal(error instanceof ApiHttpError, true);
            assert.equal(error.status, 502);
            assert.equal(error.message, 'API Error: 502');
            return true;
        },
    );
});

test('API parser rejects application failures and malformed success payloads', async () => {
    await assert.rejects(
        readApiJson(response({ payload: { success: false, error: 'Denied', code: 'DENIED' } })),
        (error) => {
            assert.equal(error instanceof ApiApplicationError, true);
            assert.equal(error.apiCode, 'DENIED');
            return true;
        },
    );
    await assert.rejects(
        readApiJson(response({ payload: [] })),
        MalformedApiResponseError,
    );
    await assert.rejects(
        readApiJson(response({ jsonError: new SyntaxError('bad json') })),
        MalformedApiResponseError,
    );
    await assert.rejects(readApiJson(null), MalformedApiResponseError);
});

test('read timeout is definite local failure, but every non-explicit mutation failure is ambiguous', () => {
    const readTimeout = markRequestOutcome(new RequestTimeoutError(30_000), 'GET');
    assert.equal(readTimeout.outcomeAmbiguous, false);
    assert.match(
        formatRequestError(readTimeout, { action: '載入資料', method: 'GET' }),
        /載入資料逾時/,
    );

    const uncertainFailures = [
        new RequestTimeoutError(30_000),
        new RequestAbortedError({ reason: 'navigation' }),
        new MalformedApiResponseError(),
        new TypeError('network down'),
        'non-Error rejection',
        null,
    ];
    for (const failure of uncertainFailures) {
        const contextual = markRequestOutcome(failure, 'POST');
        assert.equal(contextual instanceof Error, true);
        assert.equal(contextual.outcomeAmbiguous, true);
        assert.match(
            formatRequestError(contextual, { action: '新增交易', method: 'POST' }),
            /新增交易結果不確定.*伺服器可能已完成操作.*重新整理確認結果.*重試/,
        );
    }
});

test('explicit HTTP/application rejection stays definite and keeps its server message', () => {
    const httpError = markRequestOutcome(new ApiHttpError('Conflict', { status: 409 }), 'POST');
    const applicationError = markRequestOutcome(new ApiApplicationError('Denied'), 'DELETE');

    assert.equal(httpError.outcomeAmbiguous, false);
    assert.equal(applicationError.outcomeAmbiguous, false);
    assert.equal(formatRequestError(httpError, { action: '更新交易', method: 'POST' }), 'Conflict');
    assert.equal(formatRequestError(applicationError, { action: '刪除交易', method: 'DELETE' }), 'Denied');
});

test('only explicit HTTP/application rejections are classified as definite server rejection', () => {
    assert.equal(isExplicitServerRejection(new ApiHttpError('no', { status: 400 })), true);
    assert.equal(isExplicitServerRejection(new ApiApplicationError('no')), true);
    assert.equal(isExplicitServerRejection(new RequestTimeoutError(100)), false);
    assert.equal(isExplicitServerRejection(new MalformedApiResponseError()), false);
    assert.equal(isExplicitServerRejection(new TypeError('network')), false);
});

test('portfolio store routes all API traffic and body parsing through the bounded authenticated path', async () => {
    const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
    const fetchWithAuthStart = source.indexOf('const fetchWithAuth');
    const fetchWithAuthEnd = source.indexOf('const resetData');
    assert.notEqual(fetchWithAuthStart, -1);
    assert.notEqual(fetchWithAuthEnd, -1);
    const fetchWithAuthBlock = source.slice(fetchWithAuthStart, fetchWithAuthEnd);

    assert.match(source, /from '\.\.\/services\/fetchDeadline'/);
    assert.match(source, /from '\.\.\/services\/apiResponse'/);
    assert.match(source, /from '\.\.\/services\/requestErrors'/);
    assert.match(fetchWithAuthBlock, /fetchWithDeadline\(/);
    assert.match(fetchWithAuthBlock, /DEFAULT_REQUEST_TIMEOUT_MS/);
    assert.match(fetchWithAuthBlock, /responseHandler:\s*async \(response\)/);
    assert.match(fetchWithAuthBlock, /response\.status === 401[\s\S]*?await readApiJson\(response, \{ endpoint \}\)/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.match(source, /fetchWithAuth\('\/api\/user-settings',\s*\{\s*method:\s*'POST'/s);
    assert.match(source, /fetchWithAuth\('\/api\/trigger-update',\s*\{\s*method:\s*'POST'/s);
    assert.match(source, /'Idempotency-Key':\s*idempotencyKey/);
    assert.match(fetchWithAuthBlock, /if \(refreshed\) return fetchWithAuth\(endpoint, options, false\)/);
    assert.match(source, /if \(isExplicitServerRejection\(contextualError\)\) clearPendingCalculationRequest\(\)/);
    assert.match(source, /formatRequestError\(error,\s*\{\s*action:\s*'新增交易',\s*method:\s*'POST'/s);
    assert.match(source, /formatRequestError\(error,\s*\{\s*action:\s*'更新交易',\s*method:\s*'PUT'/s);
    assert.match(source, /formatRequestError\(error,\s*\{\s*action:\s*'刪除交易',\s*method:\s*'DELETE'/s);
    assert.doesNotMatch(fetchWithAuthBlock, /setTimeout\s*\(/);
    assert.doesNotMatch(fetchWithAuthBlock, /while\s*\(|for\s*\(/);
});

test('default deadline remains thirty seconds', () => {
    assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 30_000);
});
