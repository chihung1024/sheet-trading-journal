import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMarketRefreshLeadership,
    MARKET_REFRESH_PAUSE_STORAGE_KEY,
} from '../src/services/marketRefreshLeadership.js';

const createStorage = (initial = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        value(key) {
            return values.get(key) ?? null;
        },
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
    };
};

const sequence = (...values) => {
    let index = 0;
    return () => values[index++] ?? `${values.at(-1)}-${index}`;
};

const createSwitchableDelay = () => {
    let hold = false;
    const pending = [];
    return {
        delay() {
            if (!hold) return Promise.resolve();
            return new Promise((resolve) => pending.push(resolve));
        },
        hold() {
            hold = true;
        },
        releaseAll() {
            hold = false;
            while (pending.length) pending.shift()();
        },
        get pendingCount() {
            return pending.length;
        },
    };
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
    eventTarget = createEventTarget(),
    delay = async () => {},
    randomId,
    onLeadershipChange = () => {},
    onPauseChange = () => {},
    deriveScopeKey = () => 'scope-a',
} = {}) => ({
    instance: createMarketRefreshLeadership({
        storage,
        eventTarget,
        now: () => 100,
        delay,
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        randomId,
        deriveScopeKey,
        leaseTtlMs: 1000,
        renewIntervalMs: 300,
        settleMs: 10,
        onLeadershipChange,
        onPauseChange,
        logger: silentLogger,
    }),
    eventTarget,
});

test('pause from any tab releases the leader and blocks every contender until shared resume', async () => {
    const storage = createStorage();
    const pauseChangesA = [];
    const pauseChangesB = [];
    const a = coordinator({
        storage,
        randomId: sequence('owner-a', 'lease-a', 'pause-on', 'lease-a2'),
        onPauseChange: (value) => pauseChangesA.push(value),
    });
    const b = coordinator({
        storage,
        randomId: sequence('owner-b', 'pause-off', 'lease-b'),
        onPauseChange: (value) => pauseChangesB.push(value),
    });

    assert.equal(await a.instance.start('token'), true);
    assert.equal(await b.instance.start('token'), false);
    assert.equal(a.instance.isLeader(), true);

    assert.equal(await b.instance.setPaused(true), true);
    a.eventTarget.dispatchStorage(b.instance.getPauseStorageKey());
    await flushMicrotasks();
    assert.equal(await a.instance.runElection(), false);
    assert.equal(a.instance.isLeader(), false);
    assert.equal(a.instance.isPaused(), true);
    assert.equal(b.instance.isPaused(), true);
    assert.deepEqual(pauseChangesA, [true]);
    assert.deepEqual(pauseChangesB, [true]);

    assert.equal(await b.instance.setPaused(false), true);
    a.eventTarget.dispatchStorage(b.instance.getPauseStorageKey());
    await flushMicrotasks();
    assert.equal(a.instance.isPaused(), false);
    assert.equal(b.instance.isPaused(), false);

    const results = await Promise.all([
        a.instance.runElection(),
        b.instance.runElection(),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(Number(a.instance.isLeader()) + Number(b.instance.isLeader()), 1);
});

test('a pause control write cannot be overwritten by an in-flight automatic action claim', async () => {
    const storage = createStorage();
    const actionDelay = createSwitchableDelay();
    const a = coordinator({
        storage,
        delay: actionDelay.delay,
        randomId: sequence('owner-a', 'lease-a', 'action-a'),
    });
    const b = coordinator({
        storage,
        randomId: sequence('owner-b', 'pause-on'),
    });

    assert.equal(await a.instance.start('token'), true);
    assert.equal(await b.instance.start('token'), false);

    actionDelay.hold();
    const pendingAction = a.instance.claimAutomaticAction(0);
    await flushMicrotasks();
    assert.equal(actionDelay.pendingCount, 1);

    assert.equal(await b.instance.setPaused(true), true);
    assert.equal(JSON.parse(storage.value(b.instance.getPauseStorageKey())).paused, true);

    actionDelay.releaseAll();
    assert.equal(await pendingAction, false);
    assert.equal(a.instance.isLeader(), false);
    assert.equal(a.instance.isPaused(), true);
    assert.equal(JSON.parse(storage.value(b.instance.getPauseStorageKey())).paused, true);
});

test('corrupt pause state fails closed but an explicit resume rewrites a valid control record', async () => {
    const pauseKey = `${MARKET_REFRESH_PAUSE_STORAGE_KEY}scope-a`;
    const storage = createStorage({ [pauseKey]: '{broken-json' });
    const c = coordinator({
        storage,
        randomId: sequence('owner', 'pause-recover', 'lease-after-recovery'),
    }).instance;

    assert.equal(await c.start('token'), false);
    assert.equal(c.isPaused(), true);
    assert.equal(c.isLeader(), false);

    assert.equal(await c.setPaused(false), true);
    assert.equal(c.isPaused(), false);
    assert.deepEqual(JSON.parse(storage.value(pauseKey)), {
        version: 1,
        paused: false,
        claimId: 'pause-recover',
    });
    assert.equal(await c.runElection(), true);
    assert.equal(c.isLeader(), true);
});

test('closing or hiding the owner releases only the lease and preserves shared pause intent', async () => {
    const storage = createStorage();
    const a = coordinator({
        storage,
        randomId: sequence('owner-a', 'lease-a', 'pause-on'),
    }).instance;

    assert.equal(await a.start('token'), true);
    assert.equal(await a.setPaused(true), true);
    const pauseKey = a.getPauseStorageKey();
    a.stop();

    assert.equal(JSON.parse(storage.value(pauseKey)).paused, true);

    const b = coordinator({
        storage,
        randomId: sequence('owner-b', 'lease-b'),
    }).instance;
    assert.equal(await b.start('token'), false);
    assert.equal(b.isPaused(), true);
    assert.equal(b.isLeader(), false);
});

test('pause callbacks and constructor validation are explicit', () => {
    const storage = createStorage();
    assert.throws(() => createMarketRefreshLeadership({
        storage,
        randomId: () => 'owner',
        onPauseChange: null,
    }), TypeError);
});
