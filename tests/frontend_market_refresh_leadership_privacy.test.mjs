import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMarketRefreshLeadership,
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

test('lease storage key and payload contain no raw token, email, or signed subject', async () => {
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
    const ids = ['owner-id', 'lease-id'];
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
    const key = leadership.getStorageKey();
    const rawRecord = values.get(key);

    assert.match(key, new RegExp(`^${MARKET_REFRESH_LEASE_STORAGE_KEY.replace(/\./g, '\\.')}[0-9a-f]{16}$`));
    for (const forbidden of [token, email, subject]) {
        assert.equal(key.includes(forbidden), false);
        assert.equal(rawRecord.includes(forbidden), false);
    }

    const record = JSON.parse(rawRecord);
    assert.deepEqual(Object.keys(record).sort(), [
        'actionClaimId',
        'expiresAt',
        'lastActionAt',
        'leaseId',
        'ownerId',
        'version',
    ]);
    assert.equal('scope' in record, false);
    assert.equal('token' in record, false);
    assert.equal('email' in record, false);
});
