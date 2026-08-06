import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMarketRefreshLeadership,
    MARKET_REFRESH_LEASE_STORAGE_KEY,
    MARKET_REFRESH_PAUSE_STORAGE_KEY,
} from '../src/services/marketRefreshLeadership.js';

const encodeBase64Url = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const makeJwt = (claims) => (
    `${encodeBase64Url('{"alg":"none"}')}.${encodeBase64Url(JSON.stringify(claims))}.signature`
);

test('lease and pause storage contain no raw token, email, or signed subject', async () => {
    const email = 'tenant@example.test';
    const subject = 'opaque-google-subject-123456789';
    const token = makeJwt({
        exp: 2_000_000_000,
        email,
        sub: subject,
    });
    const values = new Map();
    const storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
    };
    const ids = ['owner-id', 'lease-id', 'pause-claim-id'];
    const leadership = createMarketRefreshLeadership({
        storage,
        eventTarget: null,
        now: () => 100,
        delay: async () => {},
        setIntervalImpl: () => 1,
        clearIntervalImpl() {},
        randomId: () => ids.shift() || 'next-id',
        leaseTtlMs: 1000,
        renewIntervalMs: 300,
        settleMs: 10,
        logger: {},
    });

    assert.equal(await leadership.start(token), true);
    assert.equal(await leadership.setPaused(true), true);

    const leaseKey = leadership.getStorageKey();
    const pauseKey = leadership.getPauseStorageKey();
    const rawLease = values.get(leaseKey);
    const rawPause = values.get(pauseKey);

    assert.match(
        leaseKey,
        new RegExp(`^${MARKET_REFRESH_LEASE_STORAGE_KEY.replace(/\./g, '\\.')}[0-9a-f]{16}$`),
    );
    assert.match(
        pauseKey,
        new RegExp(`^${MARKET_REFRESH_PAUSE_STORAGE_KEY.replace(/\./g, '\\.')}[0-9a-f]{16}$`),
    );
    assert.equal(
        leaseKey.slice(MARKET_REFRESH_LEASE_STORAGE_KEY.length),
        pauseKey.slice(MARKET_REFRESH_PAUSE_STORAGE_KEY.length),
    );

    for (const forbidden of [token, email, subject]) {
        for (const persisted of [leaseKey, pauseKey, rawLease, rawPause]) {
            assert.equal(persisted.includes(forbidden), false);
        }
    }

    const leaseRecord = JSON.parse(rawLease);
    assert.deepEqual(Object.keys(leaseRecord).sort(), [
        'actionClaimId',
        'expiresAt',
        'lastActionAt',
        'leaseId',
        'ownerId',
        'version',
    ]);
    assert.equal('scope' in leaseRecord, false);
    assert.equal('token' in leaseRecord, false);
    assert.equal('email' in leaseRecord, false);

    const pauseRecord = JSON.parse(rawPause);
    assert.deepEqual(Object.keys(pauseRecord).sort(), [
        'claimId',
        'paused',
        'version',
    ]);
    assert.equal(pauseRecord.paused, true);
    assert.equal('scope' in pauseRecord, false);
    assert.equal('token' in pauseRecord, false);
    assert.equal('email' in pauseRecord, false);
});
