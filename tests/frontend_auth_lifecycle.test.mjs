import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { exchangeGoogleCredential } from '../src/services/authApi.js';
import {
    GOOGLE_REFRESH_TIMEOUT_MS,
    createGoogleCredentialRefreshController,
} from '../src/services/googleCredentialRefresh.js';
import {
    JwtClaimsError,
    decodeJwtClaims,
    getJwtSecondsUntilExpiry,
    isJwtExpired,
} from '../src/services/jwtClaims.js';
import {
    TOKEN_CHECK_INTERVAL_MS,
    TOKEN_REFRESH_THRESHOLD_SECONDS,
    createTokenRefreshMonitor,
} from '../src/services/tokenRefreshMonitor.js';
import {
    MalformedApiResponseError,
    RequestAbortedError,
    RequestTimeoutError,
} from '../src/services/requestErrors.js';

const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const createManualTimeout = () => {
    let callback = null;
    const cleared = [];
    return {
        setTimeoutImpl(fn) {
            callback = fn;
            return 71;
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

const createManualInterval = () => {
    let callback = null;
    const cleared = [];
    let calls = 0;
    return {
        setIntervalImpl(fn, delay) {
            calls += 1;
            callback = fn;
            assert.equal(delay, TOKEN_CHECK_INTERVAL_MS);
            return 91;
        },
        clearIntervalImpl(id) {
            cleared.push(id);
        },
        tick() {
            assert.equal(typeof callback, 'function');
            callback();
        },
        get calls() {
            return calls;
        },
        cleared,
    };
};

const encodeBase64Url = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const makeJwt = (claims, { rawPayload = null } = {}) => {
    const payload = rawPayload ?? JSON.stringify(claims);
    return `${encodeBase64Url('{"alg":"none"}')}.${encodeBase64Url(payload)}.signature`;
};

const makeJwtFromBytes = (bytes) => (
    `${encodeBase64Url('{"alg":"none"}')}.${Buffer.from(bytes).toString('base64url')}.signature`
);

const apiResponse = ({ ok = true, status = 200, payload, jsonPromise = null } = {}) => ({
    ok,
    status,
    json() {
        return jsonPromise || Promise.resolve(payload);
    },
});

const createGoogleIdentityHarness = () => {
    let initializeOptions = null;
    let promptCallback = null;
    let initializeCalls = 0;
    let promptCalls = 0;
    return {
        identity: {
            initialize(options) {
                initializeCalls += 1;
                initializeOptions = options;
            },
            prompt(callback) {
                promptCalls += 1;
                promptCallback = callback;
            },
        },
        credential(credential = 'credential-value') {
            assert.equal(typeof initializeOptions?.callback, 'function');
            return initializeOptions.callback({ credential });
        },
        notify(notification) {
            assert.equal(typeof promptCallback, 'function');
            promptCallback(notification);
        },
        get initializeOptions() {
            return initializeOptions;
        },
        get initializeCalls() {
            return initializeCalls;
        },
        get promptCalls() {
            return promptCalls;
        },
    };
};

const silentLogger = Object.freeze({
    log() {},
    warn() {},
    error() {},
});

// JWT claims

test('JWT decoder restores Base64URL padding and preserves Unicode claims', () => {
    const token = makeJwt({
        exp: 2_000_000_000,
        name: '測試使用者',
        email: 'user@example.com',
    });
    const payloadSegment = token.split('.')[1];
    assert.notEqual(payloadSegment.length % 4, 0);

    const claims = decodeJwtClaims(token);
    assert.equal(claims.name, '測試使用者');
    assert.equal(claims.email, 'user@example.com');
    assert.equal(claims.exp, 2_000_000_000);
});

test('JWT decoder rejects malformed shape, alphabet, padding, UTF-8, JSON, and claims', () => {
    const invalidTokens = [
        '',
        'one.two',
        'one.invalid*.three',
        'one.a.three',
        makeJwtFromBytes([0xc3, 0x28]),
        makeJwt({}, { rawPayload: '{not-json' }),
        makeJwt([]),
        makeJwt({}),
        makeJwt({ exp: '2000000000' }),
        makeJwt({ exp: 0 }),
        makeJwt({ exp: Number.MAX_SAFE_INTEGER + 1 }),
    ];

    for (const token of invalidTokens) {
        assert.throws(() => decodeJwtClaims(token), JwtClaimsError);
    }
});

test('JWT expiry helpers enforce exact skew semantics and validate time inputs', () => {
    const nowMs = 1_700_000_000_000;
    const nowSeconds = Math.floor(nowMs / 1000);
    const exactBoundary = makeJwt({ exp: nowSeconds + 300 });
    const insideBoundary = makeJwt({ exp: nowSeconds + 299 });

    assert.equal(getJwtSecondsUntilExpiry(exactBoundary, { nowMs }), 300);
    assert.equal(isJwtExpired(exactBoundary, { nowMs, skewSeconds: 300 }), false);
    assert.equal(isJwtExpired(insideBoundary, { nowMs, skewSeconds: 300 }), true);
    assert.throws(() => getJwtSecondsUntilExpiry(exactBoundary, { nowMs: Number.NaN }), JwtClaimsError);
    assert.throws(() => isJwtExpired(exactBoundary, { skewSeconds: -1 }), JwtClaimsError);
});

// Authentication exchange

test('auth exchange uses the exact endpoint, payload, header, complete parser, and validated fields', async () => {
    const nowMs = 1_700_000_000_000;
    const token = makeJwt({
        exp: Math.floor(nowMs / 1000) + 3600,
        email: 'user@example.com',
    });
    const timers = createManualTimeout();
    let request = null;
    let receivedSignal = null;

    const result = await exchangeGoogleCredential(' google-credential ', {
        apiBaseUrl: 'https://api.example.test',
        nowMs,
        fetchImpl: async (url, init) => {
            request = { url, init };
            receivedSignal = init.signal;
            return apiResponse({
                payload: {
                    success: true,
                    token,
                    user: 'Example User',
                    email: 'user@example.com',
                    picture: ' https://images.example.test/user.png ',
                },
            });
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    assert.equal(request.url, 'https://api.example.test/auth/google');
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(request.init.body), { id_token: ' google-credential ' });
    assert.equal(receivedSignal instanceof AbortSignal, true);
    assert.equal(receivedSignal.aborted, false);
    assert.deepEqual(result, {
        token,
        user: {
            name: 'Example User',
            email: 'user@example.com',
            picture: 'https://images.example.test/user.png',
        },
    });
    assert.deepEqual(timers.cleared, [71]);
});

test('auth exchange rejects missing required response fields and invalid or near-expiry tokens', async () => {
    const nowMs = 1_700_000_000_000;
    const validToken = makeJwt({ exp: Math.floor(nowMs / 1000) + 3600 });
    const nearExpiryToken = makeJwt({ exp: Math.floor(nowMs / 1000) + 299 });
    const payloads = [
        { success: true, user: 'User', email: 'user@example.com' },
        { success: true, token: validToken, email: 'user@example.com' },
        { success: true, token: validToken, user: 'User' },
        { success: true, token: validToken, user: 42, email: 'user@example.com' },
        { success: true, token: validToken, user: 'User', email: '   ' },
        { success: true, token: nearExpiryToken, user: 'User', email: 'user@example.com' },
        { success: true, token: 'not-a-jwt', user: 'User', email: 'user@example.com' },
    ];

    for (const payload of payloads) {
        await assert.rejects(
            exchangeGoogleCredential('credential', {
                apiBaseUrl: 'https://api.example.test',
                nowMs,
                fetchImpl: async () => apiResponse({ payload }),
            }),
            MalformedApiResponseError,
        );
    }
});

test('auth exchange keeps the deadline active through a stalled JSON body', async () => {
    const timers = createManualTimeout();
    const body = deferred();
    let receivedSignal = null;
    const pending = exchangeGoogleCredential('credential', {
        apiBaseUrl: 'https://api.example.test',
        timeoutMs: 900,
        fetchImpl: async (_url, init) => {
            receivedSignal = init.signal;
            return apiResponse({ jsonPromise: body.promise });
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
    });

    await flushMicrotasks();
    timers.fire();

    await assert.rejects(pending, (error) => {
        assert.equal(error instanceof RequestTimeoutError, true);
        assert.equal(error.timeoutMs, 900);
        return true;
    });
    assert.equal(receivedSignal.aborted, true);
    assert.deepEqual(timers.cleared, [71]);
});

test('auth exchange propagates external cancellation into the underlying request', async () => {
    const external = new AbortController();
    let receivedSignal = null;
    const pending = exchangeGoogleCredential('credential', {
        apiBaseUrl: 'https://api.example.test',
        signal: external.signal,
        fetchImpl: async (_url, init) => {
            receivedSignal = init.signal;
            return new Promise(() => {});
        },
    });

    await flushMicrotasks();
    external.abort('logout');

    await assert.rejects(pending, (error) => {
        assert.equal(error instanceof RequestAbortedError, true);
        assert.equal(error.reason, 'logout');
        return true;
    });
    assert.equal(receivedSignal.aborted, true);
});

test('auth exchange rejects invalid configuration before network activity', async () => {
    let fetchCalls = 0;
    const fetchImpl = async () => {
        fetchCalls += 1;
    };

    await assert.rejects(exchangeGoogleCredential('', {
        apiBaseUrl: 'https://api.example.test',
        fetchImpl,
    }), TypeError);
    await assert.rejects(exchangeGoogleCredential('credential', {
        apiBaseUrl: '',
        fetchImpl,
    }), TypeError);
    assert.equal(fetchCalls, 0);
});

// Google refresh controller

test('Google refresh controller is single-flight and exchanges one credential', async () => {
    const harness = createGoogleIdentityHarness();
    const timers = createManualTimeout();
    const exchange = deferred();
    let exchangeCalls = 0;
    let exchangeSignal = null;
    const controller = createGoogleCredentialRefreshController({
        getGoogleIdentity: () => harness.identity,
        clientId: 'client-id',
        exchangeCredential: (_credential, { signal }) => {
            exchangeCalls += 1;
            exchangeSignal = signal;
            return exchange.promise;
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
        logger: silentLogger,
    });

    const first = controller.refresh();
    const second = controller.refresh();
    assert.equal(first, second);
    assert.equal(controller.isRefreshing(), true);
    assert.equal(harness.initializeCalls, 1);
    assert.equal(harness.promptCalls, 1);

    const callbackPromise = harness.credential('new-google-credential');
    await flushMicrotasks();
    assert.equal(exchangeCalls, 1);
    assert.equal(exchangeSignal.aborted, false);
    exchange.resolve(true);

    assert.equal(await first, true);
    await callbackPromise;
    assert.equal(controller.isRefreshing(), false);
    assert.equal(exchangeSignal.aborted, false);
    assert.deepEqual(timers.cleared, [71]);
});

test('Google refresh controller safely handles unavailable or throwing provider lookup', async () => {
    const unavailable = createGoogleCredentialRefreshController({
        getGoogleIdentity: () => null,
        clientId: 'client-id',
        exchangeCredential: async () => true,
        logger: null,
    });
    assert.equal(await unavailable.refresh(), false);

    const throwing = createGoogleCredentialRefreshController({
        getGoogleIdentity: () => { throw new Error('provider getter failed'); },
        clientId: 'client-id',
        exchangeCredential: async () => true,
        logger: null,
    });
    assert.equal(await throwing.refresh(), false);
});

test('Google refresh controller rejects missing credential and prompt terminal moments', async () => {
    const momentFactories = [
        () => ({
            isNotDisplayed: () => true,
            isSkippedMoment: () => false,
            isDismissedMoment: () => false,
        }),
        () => ({
            isNotDisplayed: () => false,
            isSkippedMoment: () => true,
            isDismissedMoment: () => false,
        }),
        () => ({
            isNotDisplayed: () => false,
            isSkippedMoment: () => false,
            isDismissedMoment: () => true,
        }),
    ];

    const missingCredentialHarness = createGoogleIdentityHarness();
    const missingTimers = createManualTimeout();
    let exchangeCalls = 0;
    const missingController = createGoogleCredentialRefreshController({
        getGoogleIdentity: () => missingCredentialHarness.identity,
        clientId: 'client-id',
        exchangeCredential: async () => {
            exchangeCalls += 1;
            return true;
        },
        setTimeoutImpl: missingTimers.setTimeoutImpl,
        clearTimeoutImpl: missingTimers.clearTimeoutImpl,
        logger: silentLogger,
    });
    const missingPromise = missingController.refresh();
    await missingCredentialHarness.credential('');
    assert.equal(await missingPromise, false);
    assert.equal(exchangeCalls, 0);
    assert.deepEqual(missingTimers.cleared, [71]);

    for (const createMoment of momentFactories) {
        const harness = createGoogleIdentityHarness();
        const timers = createManualTimeout();
        const controller = createGoogleCredentialRefreshController({
            getGoogleIdentity: () => harness.identity,
            clientId: 'client-id',
            exchangeCredential: async () => true,
            setTimeoutImpl: timers.setTimeoutImpl,
            clearTimeoutImpl: timers.clearTimeoutImpl,
            logger: silentLogger,
        });
        const promise = controller.refresh();
        harness.notify(createMoment());
        assert.equal(await promise, false);
        assert.deepEqual(timers.cleared, [71]);
    }
});

test('Google refresh timeout and cancel abort an active credential exchange and ignore late completion', async () => {
    for (const mode of ['timeout', 'cancel']) {
        const harness = createGoogleIdentityHarness();
        const timers = createManualTimeout();
        const exchange = deferred();
        let signal = null;
        const controller = createGoogleCredentialRefreshController({
            getGoogleIdentity: () => harness.identity,
            clientId: 'client-id',
            exchangeCredential: (_credential, options) => {
                signal = options.signal;
                return exchange.promise;
            },
            setTimeoutImpl: timers.setTimeoutImpl,
            clearTimeoutImpl: timers.clearTimeoutImpl,
            logger: silentLogger,
        });
        const promise = controller.refresh();
        void harness.credential();
        await flushMicrotasks();
        assert.equal(signal.aborted, false);

        if (mode === 'timeout') timers.fire();
        else controller.cancel();

        assert.equal(await promise, false);
        assert.equal(signal.aborted, true);
        assert.equal(controller.isRefreshing(), false);
        assert.deepEqual(timers.cleared, [71]);
        exchange.resolve(true);
        await flushMicrotasks();
        assert.equal(controller.isRefreshing(), false);
    }
});

test('Google refresh callback failure clears the timer and allows a later operation', async () => {
    const harness = createGoogleIdentityHarness();
    const timers = createManualTimeout();
    let calls = 0;
    const controller = createGoogleCredentialRefreshController({
        getGoogleIdentity: () => harness.identity,
        clientId: 'client-id',
        exchangeCredential: async () => {
            calls += 1;
            if (calls === 1) throw new Error('exchange failed');
            return true;
        },
        setTimeoutImpl: timers.setTimeoutImpl,
        clearTimeoutImpl: timers.clearTimeoutImpl,
        logger: silentLogger,
    });

    const first = controller.refresh();
    await harness.credential();
    assert.equal(await first, false);
    assert.equal(controller.isRefreshing(), false);

    const second = controller.refresh();
    await harness.credential();
    assert.equal(await second, true);
    assert.equal(calls, 2);
});

test('Google refresh controller validates constructor dependencies', () => {
    assert.throws(() => createGoogleCredentialRefreshController({
        getGoogleIdentity: null,
        clientId: 'client-id',
        exchangeCredential: async () => true,
    }), TypeError);
    assert.throws(() => createGoogleCredentialRefreshController({
        clientId: '',
        exchangeCredential: async () => true,
    }), TypeError);
    assert.throws(() => createGoogleCredentialRefreshController({
        clientId: 'client-id',
        exchangeCredential: null,
    }), TypeError);
    assert.throws(() => createGoogleCredentialRefreshController({
        clientId: 'client-id',
        exchangeCredential: async () => true,
        timeoutMs: 0,
    }), TypeError);
    assert.equal(GOOGLE_REFRESH_TIMEOUT_MS, 10_000);
});

// Token refresh monitor

test('token monitor starts for a restored token, checks immediately, and stops on logout', async () => {
    let token = 'restored-token';
    let checks = 0;
    const intervals = createManualInterval();
    const monitor = createTokenRefreshMonitor({
        getToken: () => token,
        refreshToken: async () => true,
        getSecondsUntilExpiry: () => {
            checks += 1;
            return 3600;
        },
        setIntervalImpl: intervals.setIntervalImpl,
        clearIntervalImpl: intervals.clearIntervalImpl,
        logger: silentLogger,
    });

    assert.equal(monitor.syncToken(token), true);
    assert.equal(monitor.isRunning(), true);
    await flushMicrotasks();
    assert.equal(checks, 1);
    intervals.tick();
    await flushMicrotasks();
    assert.equal(checks, 2);

    token = '';
    assert.equal(monitor.syncToken(token), false);
    assert.equal(monitor.isRunning(), false);
    assert.deepEqual(intervals.cleared, [91]);
});

test('token monitor starts after login when mount began without a token', async () => {
    let token = '';
    const intervals = createManualInterval();
    let checks = 0;
    const monitor = createTokenRefreshMonitor({
        getToken: () => token,
        refreshToken: async () => true,
        getSecondsUntilExpiry: () => {
            checks += 1;
            return 3600;
        },
        setIntervalImpl: intervals.setIntervalImpl,
        clearIntervalImpl: intervals.clearIntervalImpl,
        logger: silentLogger,
    });

    assert.equal(monitor.syncToken(token), false);
    assert.equal(intervals.calls, 0);
    token = 'fresh-login-token';
    assert.equal(monitor.syncToken(token), true);
    await flushMicrotasks();
    assert.equal(intervals.calls, 1);
    assert.equal(checks, 1);
});

test('token monitor refreshes near expiry, skips far expiry, and fails closed on malformed claims', async () => {
    let secondsRemaining = 3600;
    let refreshCalls = 0;
    const monitor = createTokenRefreshMonitor({
        getToken: () => 'token',
        refreshToken: async () => {
            refreshCalls += 1;
            return true;
        },
        getSecondsUntilExpiry: () => secondsRemaining,
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        logger: null,
    });

    assert.equal(await monitor.checkAndRefresh(), true);
    assert.equal(refreshCalls, 0);

    secondsRemaining = TOKEN_REFRESH_THRESHOLD_SECONDS - 1;
    assert.equal(await monitor.checkAndRefresh(), true);
    assert.equal(refreshCalls, 1);

    const malformed = createTokenRefreshMonitor({
        getToken: () => 'bad-token',
        refreshToken: async () => {
            refreshCalls += 1;
            return true;
        },
        getSecondsUntilExpiry: () => { throw new JwtClaimsError('bad claims'); },
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        logger: null,
    });
    assert.equal(await malformed.checkAndRefresh(), false);
    assert.equal(refreshCalls, 1);
});

test('token monitor shares overlapping checks and never refreshes a stale token', async () => {
    let token = 'token-a';
    const refresh = deferred();
    let refreshCalls = 0;
    const monitor = createTokenRefreshMonitor({
        getToken: () => token,
        refreshToken: () => {
            refreshCalls += 1;
            return refresh.promise;
        },
        getSecondsUntilExpiry: () => 1,
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        logger: silentLogger,
    });

    const first = monitor.checkAndRefresh();
    const second = monitor.checkAndRefresh();
    assert.equal(first, second);
    await flushMicrotasks();
    assert.equal(refreshCalls, 1);
    refresh.resolve(true);
    assert.equal(await first, true);
    assert.equal(monitor.isChecking(), false);

    token = 'token-a';
    const staleMonitor = createTokenRefreshMonitor({
        getToken: () => token,
        refreshToken: async () => {
            refreshCalls += 1;
            return true;
        },
        getSecondsUntilExpiry: () => {
            token = 'token-b';
            return 1;
        },
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        logger: silentLogger,
    });
    assert.equal(await staleMonitor.checkAndRefresh(), false);
    assert.equal(refreshCalls, 1);
});

test('token monitor is idempotent and validates dependencies', () => {
    const intervals = createManualInterval();
    const monitor = createTokenRefreshMonitor({
        getToken: () => 'token',
        refreshToken: async () => true,
        getSecondsUntilExpiry: () => 3600,
        setIntervalImpl: intervals.setIntervalImpl,
        clearIntervalImpl: intervals.clearIntervalImpl,
        logger: silentLogger,
    });
    assert.equal(monitor.start(), true);
    assert.equal(monitor.start(), false);
    assert.equal(monitor.stop(), true);
    assert.equal(monitor.stop(), false);

    assert.throws(() => createTokenRefreshMonitor({
        getToken: null,
        refreshToken: async () => true,
    }), TypeError);
    assert.throws(() => createTokenRefreshMonitor({
        getToken: () => 'token',
        refreshToken: null,
    }), TypeError);
    assert.throws(() => createTokenRefreshMonitor({
        getToken: () => 'token',
        refreshToken: async () => true,
        checkIntervalMs: 0,
    }), TypeError);
    assert.throws(() => createTokenRefreshMonitor({
        getToken: () => 'token',
        refreshToken: async () => true,
        refreshThresholdSeconds: -1,
    }), TypeError);
    assert.equal(TOKEN_CHECK_INTERVAL_MS, 5 * 60 * 1000);
    assert.equal(TOKEN_REFRESH_THRESHOLD_SECONDS, 10 * 60);
});

// Static integration contracts

test('auth store delegates request, claims, and refresh ownership to shared services', async () => {
    const source = await readFile(new URL('../src/stores/auth.js', import.meta.url), 'utf8');
    assert.match(source, /exchangeGoogleCredential/);
    assert.match(source, /createGoogleCredentialRefreshController/);
    assert.match(source, /decodeJwtClaims/);
    assert.match(source, /isJwtExpired/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\batob\s*\(/);
    assert.doesNotMatch(source, /setTimeout\s*\(/);
    assert.doesNotMatch(source, /accounts\.id\.initialize/);
    assert.match(source, /refreshController\?\.cancel\(\)/);

    const validationIndex = source.indexOf('decodeJwtClaims(storedToken)');
    const assignmentIndex = source.indexOf('token.value = storedToken');
    assert.notEqual(validationIndex, -1);
    assert.notEqual(assignmentIndex, -1);
    assert.equal(validationIndex < assignmentIndex, true);
});

test('token composable watches login/logout immediately and contains no duplicate timer or Google logic', async () => {
    const source = await readFile(new URL('../src/composables/useTokenRefresh.js', import.meta.url), 'utf8');
    assert.match(source, /watch\(/);
    assert.match(source, /\{ immediate: true \}/);
    assert.match(source, /monitor\.syncToken\(currentToken\)/);
    assert.match(source, /stopTokenWatch\(\)/);
    assert.match(source, /monitor\.stop\(\)/);
    assert.doesNotMatch(source, /onMounted/);
    assert.doesNotMatch(source, /setInterval\s*\(/);
    assert.doesNotMatch(source, /setTimeout\s*\(/);
    assert.doesNotMatch(source, /\batob\s*\(/);
    assert.doesNotMatch(source, /accounts\.id\.initialize/);
});

test('login overlay must clean up Google polling, timeout, and its global callback on unmount', async () => {
    const source = await readFile(new URL('../src/components/LoginOverlay.vue', import.meta.url), 'utf8');
    assert.match(source, /onUnmounted/);
    assert.match(source, /clearInterval\(/);
    assert.match(source, /clearTimeout\(/);
    assert.match(source, /delete window\.handleCredentialResponse/);
});
