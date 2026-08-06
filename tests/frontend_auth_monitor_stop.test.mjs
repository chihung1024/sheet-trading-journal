import test from 'node:test';
import assert from 'node:assert/strict';

import { createTokenRefreshMonitor } from '../src/services/tokenRefreshMonitor.js';

const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const silentLogger = Object.freeze({
    log() {},
    warn() {},
    error() {},
});

test('stop invalidates an immediate check queued by start before it can refresh', async () => {
    let refreshCalls = 0;
    let clearedTimer = null;
    const monitor = createTokenRefreshMonitor({
        getToken: () => 'near-expiry-token',
        refreshToken: async () => {
            refreshCalls += 1;
            return true;
        },
        getSecondsUntilExpiry: () => 1,
        setIntervalImpl: () => 41,
        clearIntervalImpl: (id) => {
            clearedTimer = id;
        },
        logger: silentLogger,
    });

    assert.equal(monitor.start(), true);
    assert.equal(monitor.stop(), true);
    await flushMicrotasks();

    assert.equal(clearedTimer, 41);
    assert.equal(refreshCalls, 0);
    assert.equal(monitor.isRunning(), false);
    assert.equal(monitor.isChecking(), false);
});

test('stop also invalidates a manually queued check when no interval exists', async () => {
    let refreshCalls = 0;
    const monitor = createTokenRefreshMonitor({
        getToken: () => 'near-expiry-token',
        refreshToken: async () => {
            refreshCalls += 1;
            return true;
        },
        getSecondsUntilExpiry: () => 1,
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        logger: silentLogger,
    });

    const pending = monitor.checkAndRefresh();
    assert.equal(monitor.stop(), false);
    assert.equal(await pending, false);
    assert.equal(refreshCalls, 0);
});
