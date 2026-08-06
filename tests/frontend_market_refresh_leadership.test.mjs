import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMarketRefreshLeadership,
    deriveMarketRefreshScopeKey,
    MARKET_REFRESH_LEASE_STORAGE_KEY,
} from '../src/services/marketRefreshLeadership.js';

const encodeBase64Url = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const makeJwt = (claims) => (
    `${encodeBase64Url('{"alg":"none"}')}.${encodeBase64Url(JSON.stringify(claims))}.signature`
);

const createStorage = ({
    initial = {},
    failRead = false,
    failWrite = false,
    staleEmptyReads = 0,
} = {}) => {
    const values = new Map(Object.entries(initial));
    let remainingStaleEmptyReads = staleEmptyReads;
    return {
        getItem(key) {
            if (failRead) throw new Error('read failed');
            if (remainingStaleEmptyReads > 0) {
                remainingStaleEmptyReads -= 1;
                return null;
            }
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            if (failWrite) throw new Error('write failed');
            values.set(key, String(value));
        },
        value(key) {
            return values.get(key) ?? null;
        },
        snapshot() {
            return Object.fromEntries(values);
        },
    };
};

const createManualDelay = () => {
    const pending = [];
    return {
        delay() {
            return new Promise((resolve) => pending.push(resolve));
        },
        get size() {
            return pending.length;
        },
        flushOne() {
            const resolve = pending.shift();
            if (resolve) resolve();
        },
        flushAll() {
            while (pending.length) pending.shift()();
        },
    };
};

const createIntervals = () => {
    let nextId = 1;
    const callbacks = new Map();
    const cleared = [];
    return {
        setIntervalImpl(callback) {
            const id = nextId++;
            callbacks.set(id, callback);
            return id;
        },
        clearIntervalImpl(id) {
            cleared.push(id);
            callbacks.delete(id);
        },
        tick(id) {
            callbacks.get(id)?.();
        },
        get activeCount() {
            return callbacks.size;
        },
        cleared,
    };
};

const createEventTarget = () => {
    const listeners = new Map();
    return {
        addEventListener(type, callback) {
            listeners.set(type, callback);
        },
        removeEventListener(type, callback) {
            if (listeners.get(type) === callback) listeners.delete(type);
        },
        dispatchStorage(key) {
            listeners.get('storage')?.({ key });
        },
        has(type) {
            return listeners.has(type);
        },
    };
};

const sequence = (...values) => {
    let index = 0;
    return () => values[index++] ?? `${values.at(-1)}-${index}`;
};

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

const coordinator = ({
    storage,
    now,
    delay = async () => {},
    randomId,
    eventTarget = createEventTarget(),
    intervals = createIntervals(),
    deriveScopeKey = () => 'scope-a',
    onLeadershipChange = () => {},
    leaseTtlMs = 1000,
    renewIntervalMs = 300,
    settleMs = 10,
} = {}) => ({
    instance: createMarketRefreshLeadership({
        storage,
        eventTarget,
        now,
        delay,
        randomId,
        deriveScopeKey,
        setIntervalImpl: intervals.setIntervalImpl,
        clearIntervalImpl: intervals.clearIntervalImpl,
        onLeadershipChange,
        leaseTtlMs,
        renewIntervalMs,
        settleMs,
        logger: silentLogger,
    }),
    eventTarget,
    intervals,
});

test('session scope uses signed sub and does not expose the raw identifier', () => {
    const tokenA1 = makeJwt({ exp: 2_000_000_000, email: 'a@example.test', sub: 'opaque-subject-123' });
    const tokenA2 = makeJwt({ exp: 2_000_000_100, email: 'changed@example.test', sub: 'opaque-subject-123' });
    const tokenB = makeJwt({ exp: 2_000_000_000, email: 'b@example.test', sub: 'opaque-subject-456' });

    const scopeA = deriveMarketRefreshScopeKey(tokenA1);
    assert.equal(scopeA, deriveMarketRefreshScopeKey(tokenA2));
    assert.notEqual(scopeA, deriveMarketRefreshScopeKey(tokenB));
    assert.match(scopeA, /^[0-9a-f]{16}$/);
    assert.doesNotMatch(scopeA, /opaque-subject/);

    assert.throws(
        () => deriveMarketRefreshScopeKey(makeJwt({ exp: 2_000_000_000, email: 'a@example.test' })),
        /sub claim/,
    );
    assert.throws(
        () => deriveMarketRefreshScopeKey(tokenA1, { TextEncoderImpl: null }),
        TypeError,
    );
});

test('simultaneous contenders stabilize to exactly one confirmed leader', async () => {
    // Model two real tabs that both read the pre-election empty value before either write is visible.
    const storage = createStorage({ staleEmptyReads: 2 });
    const clock = { value: 100 };
    const manualDelay = createManualDelay();
    const changesA = [];
    const changesB = [];
    const a = coordinator({
        storage,
        now: () => clock.value,
        delay: manualDelay.delay,
        randomId: sequence('owner-a', 'lease-a'),
        onLeadershipChange: (value) => changesA.push(value),
    }).instance;
    const b = coordinator({
        storage,
        now: () => clock.value,
        delay: manualDelay.delay,
        randomId: sequence('owner-b', 'lease-b'),
        onLeadershipChange: (value) => changesB.push(value),
    }).instance;

    const startA = a.start('token');
    const startB = b.start('token');
    await flushMicrotasks();
    assert.equal(manualDelay.size, 2);

    manualDelay.flushAll();
    const results = await Promise.all([startA, startB]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(Number(a.isLeader()) + Number(b.isLeader()), 1);
    assert.equal(a.isLeader(), false);
    assert.equal(b.isLeader(), true);
    assert.deepEqual(changesA, []);
    assert.deepEqual(changesB, [true]);
});

test('lease expiry permits failover and the displaced owner fails closed on observation', async () => {
    const storage = createStorage();
    const clock = { value: 0 };
    const eventA = createEventTarget();
    const a = coordinator({
        storage,
        eventTarget: eventA,
        now: () => clock.value,
        randomId: sequence('owner-a', 'lease-a', 'lease-a2'),
        leaseTtlMs: 100,
        renewIntervalMs: 30,
        settleMs: 1,
    }).instance;
    const b = coordinator({
        storage,
        now: () => clock.value,
        randomId: sequence('owner-b', 'lease-b'),
        leaseTtlMs: 100,
        renewIntervalMs: 30,
        settleMs: 1,
    }).instance;

    assert.equal(await a.start('token'), true);
    assert.equal(await b.start('token'), false);
    assert.equal(a.isLeader(), true);

    clock.value = 101;
    assert.equal(await b.runElection(), true);
    eventA.dispatchStorage(a.getStorageKey());
    await flushMicrotasks();
    assert.equal(await a.runElection(), false);
    assert.equal(a.isLeader(), false);
    assert.equal(b.isLeader(), true);
});

test('released leadership preserves automatic action cooldown across failover', async () => {
    const storage = createStorage();
    const clock = { value: 1000 };
    const timing = {
        leaseTtlMs: 500_000,
        renewIntervalMs: 100_000,
        settleMs: 10,
    };
    const a = coordinator({
        storage,
        now: () => clock.value,
        randomId: sequence('owner-a', 'lease-a', 'action-a'),
        ...timing,
    }).instance;
    const b = coordinator({
        storage,
        now: () => clock.value,
        randomId: sequence('owner-b', 'lease-b', 'action-b'),
        ...timing,
    }).instance;

    assert.equal(await a.start('token'), true);
    assert.equal(await a.claimAutomaticAction(180_000), true);
    const key = a.getStorageKey();
    a.stop();

    const tombstone = JSON.parse(storage.value(key));
    assert.equal(tombstone.ownerId, null);
    assert.equal(tombstone.expiresAt, 0);
    assert.equal(tombstone.lastActionAt, 1000);

    assert.equal(await b.start('token'), true);
    assert.equal(await b.claimAutomaticAction(180_000), false);
    clock.value = 181_001;
    assert.equal(await b.claimAutomaticAction(180_000), true);
});

test('stop and scope change invalidate queued acquisition and action work', async () => {
    const storage = createStorage();
    const clock = { value: 100 };
    const acquisitionDelay = createManualDelay();
    const c = coordinator({
        storage,
        now: () => clock.value,
        delay: acquisitionDelay.delay,
        randomId: sequence('owner', 'lease-old', 'lease-new', 'action-old'),
        deriveScopeKey: (token) => token,
    }).instance;

    const pendingStart = c.start('scope-old');
    await flushMicrotasks();
    assert.equal(acquisitionDelay.size, 1);
    const oldKey = c.getStorageKey();
    c.stop();
    acquisitionDelay.flushAll();
    assert.equal(await pendingStart, false);
    assert.equal(c.isLeader(), false);
    assert.equal(JSON.parse(storage.value(oldKey)).ownerId, null);

    const newStart = c.start('scope-new');
    await flushMicrotasks();
    acquisitionDelay.flushAll();
    assert.equal(await newStart, true);

    const pendingAction = c.claimAutomaticAction(0);
    c.stop();
    await flushMicrotasks();
    assert.equal(await pendingAction, false);
});

test('corrupt records and storage failures never grant leadership', async () => {
    const corruptKey = `${MARKET_REFRESH_LEASE_STORAGE_KEY}scope-a`;
    const corrupt = coordinator({
        storage: createStorage({ initial: { [corruptKey]: '{not-json' } }),
        now: () => 0,
        randomId: sequence('owner', 'lease'),
    }).instance;
    assert.equal(await corrupt.start('token'), false);
    assert.equal(corrupt.isLeader(), false);

    const readFailure = coordinator({
        storage: createStorage({ failRead: true }),
        now: () => 0,
        randomId: sequence('owner', 'lease'),
    }).instance;
    assert.equal(await readFailure.start('token'), false);

    const writeFailure = coordinator({
        storage: createStorage({ failWrite: true }),
        now: () => 0,
        randomId: sequence('owner', 'lease'),
    }).instance;
    assert.equal(await writeFailure.start('token'), false);
});

test('monitor and storage listener are lifecycle-bound and same scope start is idempotent', async () => {
    const storage = createStorage();
    const intervals = createIntervals();
    const eventTarget = createEventTarget();
    const c = coordinator({
        storage,
        eventTarget,
        intervals,
        now: () => 0,
        randomId: sequence('owner', 'lease', 'lease-2'),
    }).instance;

    assert.equal(await c.start('token'), true);
    assert.equal(intervals.activeCount, 1);
    assert.equal(eventTarget.has('storage'), true);
    assert.equal(await c.start('token'), true);
    assert.equal(intervals.activeCount, 1);

    c.stop();
    assert.equal(intervals.activeCount, 0);
    assert.equal(eventTarget.has('storage'), false);
    assert.equal(c.isStarted(), false);
    assert.equal(c.getStorageKey(), null);
});

test('constructor rejects unsafe dependencies and lease timing', () => {
    const storage = createStorage();
    assert.throws(() => createMarketRefreshLeadership({ storage: null }), TypeError);
    assert.throws(() => createMarketRefreshLeadership({ storage, randomId: null }), TypeError);
    assert.throws(() => createMarketRefreshLeadership({ storage, onLeadershipChange: null }), TypeError);
    assert.throws(() => createMarketRefreshLeadership({
        storage,
        randomId: () => 'owner',
        leaseTtlMs: 10,
        renewIntervalMs: 10,
        settleMs: 1,
    }), TypeError);
    assert.throws(() => createMarketRefreshLeadership({
        storage,
        randomId: () => '',
    }), TypeError);
});
