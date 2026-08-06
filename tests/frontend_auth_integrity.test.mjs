import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { exchangeGoogleCredential } from '../src/services/authApi.js';
import {
    persistAuthentication,
    readAuthenticationStorage,
} from '../src/services/authStorage.js';
import { createGoogleCredentialRefreshController } from '../src/services/googleCredentialRefresh.js';
import { decodeJwtClaims, JwtClaimsError } from '../src/services/jwtClaims.js';
import { MalformedApiResponseError } from '../src/services/requestErrors.js';

const encodeBase64Url = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const makeJwt = (claims) => (
    `${encodeBase64Url('{"alg":"none"}')}.${encodeBase64Url(JSON.stringify(claims))}.signature`
);

const response = (payload) => ({
    ok: true,
    status: 200,
    async json() {
        return payload;
    },
});

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const createStorage = (initial = {}, { failOnSetKey = null } = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            if (key === failOnSetKey) throw new Error(`set failed for ${key}`);
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        snapshot() {
            return Object.fromEntries(values);
        },
    };
};

const createIdentityHarness = () => {
    let callback = null;
    let promptCallback = null;
    return {
        identity: {
            initialize(options) {
                callback = options.callback;
            },
            prompt(handler) {
                promptCallback = handler;
            },
        },
        credential(value = 'credential') {
            return callback({ credential: value });
        },
        terminalMoment() {
            promptCallback({
                isNotDisplayed: () => false,
                isSkippedMoment: () => false,
                isDismissedMoment: () => true,
            });
        },
    };
};

const silentLogger = Object.freeze({
    log() {},
    warn() {},
    error() {},
});

test('authentication persistence publishes all keys or restores the complete prior state', () => {
    const storage = createStorage({
        token: 'old-token',
        name: 'Old Name',
        email: 'old@example.com',
        unrelated: 'preserve-me',
    });

    const persisted = persistAuthentication(storage, {
        token: 'new-token',
        user: { name: 'New Name', email: ' NEW@EXAMPLE.COM ' },
    });
    assert.deepEqual(persisted, {
        token: 'new-token',
        user: { name: 'New Name', email: 'new@example.com' },
    });
    assert.deepEqual(readAuthenticationStorage(storage), {
        token: 'new-token',
        name: 'New Name',
        email: 'new@example.com',
    });
    assert.equal(storage.snapshot().unrelated, 'preserve-me');

    const failingStorage = createStorage({
        token: 'stable-token',
        name: 'Stable Name',
        email: 'stable@example.com',
        unrelated: 'preserve-me',
    }, { failOnSetKey: 'email' });

    assert.throws(
        () => persistAuthentication(failingStorage, {
            token: 'partial-token',
            user: { name: 'Partial Name', email: 'partial@example.com' },
        }),
        (error) => {
            assert.equal(error.name, 'AuthenticationStorageError');
            assert.equal(Array.isArray(error.rollbackFailures), true);
            return true;
        },
    );
    assert.deepEqual(failingStorage.snapshot(), {
        token: 'stable-token',
        name: 'Stable Name',
        email: 'stable@example.com',
        unrelated: 'preserve-me',
    });
});

test('auth exchange binds the Worker email to signed JWT identity and normalizes the endpoint', async () => {
    const nowMs = 1_700_000_000_000;
    const token = makeJwt({
        exp: Math.floor(nowMs / 1000) + 3600,
        email: 'Signed@Example.com',
        picture: 'https://images.example.test/signed.png',
    });
    let requestedUrl = null;

    const authenticated = await exchangeGoogleCredential('credential', {
        apiBaseUrl: 'https://api.example.test///',
        nowMs,
        fetchImpl: async (url) => {
            requestedUrl = url;
            return response({
                success: true,
                token,
                user: 'Signed User',
                email: ' signed@example.com ',
            });
        },
    });

    assert.equal(requestedUrl, 'https://api.example.test/auth/google');
    assert.deepEqual(authenticated.user, {
        name: 'Signed User',
        email: 'signed@example.com',
        picture: 'https://images.example.test/signed.png',
    });

    await assert.rejects(
        exchangeGoogleCredential('credential', {
            apiBaseUrl: 'https://api.example.test',
            nowMs,
            fetchImpl: async () => response({
                success: true,
                token,
                user: 'Wrong Tenant',
                email: 'other@example.com',
            }),
        }),
        (error) => {
            assert.equal(error instanceof MalformedApiResponseError, true);
            assert.match(error.message, /does not match the signed token identity/);
            return true;
        },
    );

    const tokenWithoutEmail = makeJwt({ exp: Math.floor(nowMs / 1000) + 3600 });
    await assert.rejects(
        exchangeGoogleCredential('credential', {
            apiBaseUrl: 'https://api.example.test',
            nowMs,
            fetchImpl: async () => response({
                success: true,
                token: tokenWithoutEmail,
                user: 'No Email Claim',
                email: 'user@example.com',
            }),
        }),
        MalformedApiResponseError,
    );
});

test('JWT claims reject empty or non-compact header and signature segments', () => {
    const valid = makeJwt({ exp: 2_000_000_000, email: 'user@example.com' });
    const [, payload] = valid.split('.');
    const invalid = [
        `.${payload}.signature`,
        `header.${payload}.`,
        `head*er.${payload}.signature`,
        `header.${payload}.sig*nature`,
    ];
    for (const token of invalid) {
        assert.throws(() => decodeJwtClaims(token), JwtClaimsError);
    }
});

test('credential receipt wins over later prompt dismissal and duplicate callbacks stay single-flight', async () => {
    const harness = createIdentityHarness();
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
        logger: silentLogger,
    });

    const refresh = controller.refresh();
    const firstCallback = harness.credential();
    const duplicateCallback = harness.credential('duplicate');
    harness.terminalMoment();

    assert.equal(exchangeCalls, 1);
    assert.equal(exchangeSignal.aborted, false);
    exchange.resolve(true);
    assert.equal(await refresh, true);
    await firstCallback;
    await duplicateCallback;
});

test('refresh requires literal true from credential exchange', async () => {
    for (const result of [undefined, null, 1, 'true', false]) {
        const harness = createIdentityHarness();
        const controller = createGoogleCredentialRefreshController({
            getGoogleIdentity: () => harness.identity,
            clientId: 'client-id',
            exchangeCredential: async () => result,
            logger: silentLogger,
        });
        const refresh = controller.refresh();
        await harness.credential();
        assert.equal(await refresh, false);
    }
});

test('auth integration publishes state only after persistence and restores signed email', async () => {
    const source = await readFile(new URL('../src/stores/auth.js', import.meta.url), 'utf8');
    const persistIndex = source.indexOf('persistAuthentication(localStorage, authenticated)');
    const publishIndex = source.indexOf('token.value = persisted.token');
    assert.notEqual(persistIndex, -1);
    assert.notEqual(publishIndex, -1);
    assert.equal(persistIndex < publishIndex, true);
    assert.match(source, /const signedEmail = readSignedEmail\(claims\)/);
    assert.match(source, /email: signedEmail/);
    assert.match(source, /cancelTokenRefresh/);

    const composable = await readFile(new URL('../src/composables/useTokenRefresh.js', import.meta.url), 'utf8');
    assert.match(composable, /if \(!currentToken\) authStore\.cancelTokenRefresh\(\)/);
    assert.match(composable, /authStore\.cancelTokenRefresh\(\)/);
});

test('login overlay owns timers locally but completes an accepted login across normal unmount', async () => {
    const source = await readFile(new URL('../src/components/LoginOverlay.vue', import.meta.url), 'utf8');
    assert.match(source, /let googlePollTimer = null/);
    assert.match(source, /let googleLoadTimeout = null/);
    assert.match(source, /const clearGoogleWaitTimers/);
    assert.match(source, /callback: handleCredentialResponse/);
    assert.doesNotMatch(source, /callback: window\.handleCredentialResponse/);
    assert.match(source, /window\.handleCredentialResponse === handleCredentialResponse/);
    assert.match(source, /delete window\.handleCredentialResponse/);
    assert.match(source, /if \(!isActive\) return/);
    assert.match(source, /isGoogleInitialized/);

    const loginIndex = source.indexOf('await authStore.login(credential)');
    const fetchIndex = source.indexOf('await portfolioStore.fetchAll()');
    assert.notEqual(loginIndex, -1);
    assert.notEqual(fetchIndex, -1);
    assert.equal(loginIndex < fetchIndex, true);
    assert.doesNotMatch(source.slice(loginIndex, fetchIndex), /if \(!isActive\) return/);
});
