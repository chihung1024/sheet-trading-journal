import { decodeJwtClaims } from './jwtClaims.js';

export const MARKET_REFRESH_LEASE_STORAGE_KEY = 'sheet_trading_journal.market_refresh_leader.';
export const MARKET_REFRESH_LEASE_VERSION = 1;
export const MARKET_REFRESH_LEASE_TTL_MS = 15_000;
export const MARKET_REFRESH_LEASE_RENEW_MS = 5_000;
export const MARKET_REFRESH_LEASE_SETTLE_MS = 75;

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const FNV_MASK_64 = 0xffffffffffffffffn;

const normalizeLogger = (logger) => (
    logger && (typeof logger === 'object' || typeof logger === 'function')
        ? logger
        : {}
);

const requireStorage = (storage) => {
    if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
    ) {
        throw new TypeError('A readable and writable Storage-compatible object is required');
    }
    return storage;
};

const createDefaultRandomId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (globalThis.crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    }
    throw new Error('Secure random identifier source is unavailable');
};

const defaultDelay = (milliseconds) => new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
});

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const isTimestamp = (value) => Number.isSafeInteger(value) && value >= 0;

const validateLeaseRecord = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.version !== MARKET_REFRESH_LEASE_VERSION) return null;
    if (!isTimestamp(value.expiresAt)) return null;
    if (!(value.lastActionAt === null || isTimestamp(value.lastActionAt))) return null;
    if (!(value.actionClaimId === null || isNonEmptyString(value.actionClaimId))) return null;

    const tombstone = value.ownerId === null && value.leaseId === null && value.expiresAt === 0;
    const activeShape = isNonEmptyString(value.ownerId) && isNonEmptyString(value.leaseId);
    if (!tombstone && !activeShape) return null;

    return {
        version: MARKET_REFRESH_LEASE_VERSION,
        ownerId: tombstone ? null : value.ownerId,
        leaseId: tombstone ? null : value.leaseId,
        expiresAt: value.expiresAt,
        lastActionAt: value.lastActionAt,
        actionClaimId: value.actionClaimId,
    };
};

const parseLeaseRecord = (rawValue) => {
    if (rawValue === null) return { kind: 'empty', record: null };
    try {
        const record = validateLeaseRecord(JSON.parse(rawValue));
        return record
            ? { kind: 'valid', record }
            : { kind: 'invalid', record: null };
    } catch {
        return { kind: 'invalid', record: null };
    }
};

const serializeRecord = (record) => JSON.stringify(record);

export const deriveMarketRefreshScopeKey = (
    token,
    {
        TextEncoderImpl = globalThis.TextEncoder,
        decodeClaims = decodeJwtClaims,
    } = {},
) => {
    if (typeof decodeClaims !== 'function') throw new TypeError('decodeClaims must be a function');
    if (typeof TextEncoderImpl !== 'function') throw new TypeError('TextEncoder is unavailable');

    const claims = decodeClaims(token);
    const subject = claims?.sub;
    if (
        typeof subject !== 'string'
        || !subject.trim()
        || subject.length > 255
        || /\s/.test(subject)
    ) {
        throw new Error('JWT sub claim is unavailable for refresh coordination');
    }

    let hash = FNV_OFFSET_BASIS_64;
    for (const byte of new TextEncoderImpl().encode(subject)) {
        hash ^= BigInt(byte);
        hash = (hash * FNV_PRIME_64) & FNV_MASK_64;
    }
    return hash.toString(16).padStart(16, '0');
};

export const createMarketRefreshLeadership = ({
    storage = globalThis.localStorage,
    eventTarget = globalThis.window,
    now = () => Date.now(),
    delay = defaultDelay,
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    randomId = createDefaultRandomId,
    deriveScopeKey = deriveMarketRefreshScopeKey,
    leaseTtlMs = MARKET_REFRESH_LEASE_TTL_MS,
    renewIntervalMs = MARKET_REFRESH_LEASE_RENEW_MS,
    settleMs = MARKET_REFRESH_LEASE_SETTLE_MS,
    onLeadershipChange = () => {},
    logger = console,
} = {}) => {
    const targetStorage = requireStorage(storage);
    if (typeof now !== 'function' || typeof delay !== 'function') {
        throw new TypeError('Time providers must be functions');
    }
    if (typeof setIntervalImpl !== 'function' || typeof clearIntervalImpl !== 'function') {
        throw new TypeError('Interval implementation is unavailable');
    }
    if (typeof randomId !== 'function' || typeof deriveScopeKey !== 'function') {
        throw new TypeError('Identity providers must be functions');
    }
    if (typeof onLeadershipChange !== 'function') {
        throw new TypeError('onLeadershipChange must be a function');
    }
    if (
        !Number.isFinite(leaseTtlMs)
        || !Number.isFinite(renewIntervalMs)
        || !Number.isFinite(settleMs)
        || leaseTtlMs <= renewIntervalMs
        || renewIntervalMs <= settleMs
        || settleMs < 0
    ) {
        throw new TypeError('Lease timing must satisfy ttl > renew > settle >= 0');
    }

    const safeLogger = normalizeLogger(logger);
    const ownerId = randomId();
    if (!isNonEmptyString(ownerId)) throw new TypeError('owner identifier is required');

    let started = false;
    let leader = false;
    let storageKey = null;
    let currentLeaseId = null;
    let monitorTimer = null;
    let listenerAttached = false;
    let lifecycleEpoch = 0;
    let operationChain = Promise.resolve();

    const setLeader = (nextLeader) => {
        const normalized = nextLeader === true;
        if (leader === normalized) return;
        leader = normalized;
        try {
            onLeadershipChange(leader);
        } catch (error) {
            safeLogger.error?.('[Market refresh leadership] change callback failed', error);
        }
    };

    const readAt = (key) => {
        if (!key) return { kind: 'invalid', record: null };
        try {
            return parseLeaseRecord(targetStorage.getItem(key));
        } catch (error) {
            safeLogger.error?.('[Market refresh leadership] storage read failed', error);
            return { kind: 'invalid', record: null };
        }
    };

    const writeAt = (key, record) => {
        if (!key) return false;
        try {
            targetStorage.setItem(key, serializeRecord(record));
            return true;
        } catch (error) {
            safeLogger.error?.('[Market refresh leadership] storage write failed', error);
            return false;
        }
    };

    const enqueue = (operation) => {
        const run = operationChain
            .catch(() => false)
            .then(operation);
        operationChain = run.catch(() => false);
        return run;
    };

    const isCurrentInvocation = (observedEpoch, observedKey) => (
        started
        && observedEpoch === lifecycleEpoch
        && observedKey !== null
        && observedKey === storageKey
    );

    const loseLeadership = () => {
        currentLeaseId = null;
        setLeader(false);
    };

    const acquire = async (observedEpoch, observedKey) => {
        if (!isCurrentInvocation(observedEpoch, observedKey)) return false;

        const state = readAt(observedKey);
        if (state.kind === 'invalid') {
            loseLeadership();
            return false;
        }

        const currentTime = now();
        const existing = state.record;
        if (
            existing
            && existing.ownerId !== ownerId
            && existing.expiresAt > currentTime
        ) {
            loseLeadership();
            return false;
        }

        const candidateLeaseId = randomId();
        if (!isNonEmptyString(candidateLeaseId)) return false;
        currentLeaseId = candidateLeaseId;
        const candidate = {
            version: MARKET_REFRESH_LEASE_VERSION,
            ownerId,
            leaseId: candidateLeaseId,
            expiresAt: currentTime + leaseTtlMs,
            lastActionAt: existing?.lastActionAt ?? null,
            actionClaimId: existing?.actionClaimId ?? null,
        };
        if (!writeAt(observedKey, candidate)) {
            loseLeadership();
            return false;
        }

        await delay(settleMs);
        if (!isCurrentInvocation(observedEpoch, observedKey)) {
            loseLeadership();
            return false;
        }

        const confirmation = readAt(observedKey);
        const confirmed = confirmation.kind === 'valid'
            && confirmation.record?.ownerId === ownerId
            && confirmation.record?.leaseId === candidateLeaseId
            && confirmation.record.expiresAt > now();
        setLeader(confirmed);
        if (!confirmed) currentLeaseId = null;
        return confirmed;
    };

    const renew = async (observedEpoch, observedKey) => {
        if (
            !isCurrentInvocation(observedEpoch, observedKey)
            || !leader
            || !currentLeaseId
        ) return false;

        const state = readAt(observedKey);
        const record = state.kind === 'valid' ? state.record : null;
        if (
            !record
            || record.ownerId !== ownerId
            || record.leaseId !== currentLeaseId
            || record.expiresAt <= now()
        ) {
            loseLeadership();
            return acquire(observedEpoch, observedKey);
        }

        const renewed = {
            ...record,
            expiresAt: now() + leaseTtlMs,
        };
        if (!writeAt(observedKey, renewed)) {
            loseLeadership();
            return false;
        }

        const confirmation = readAt(observedKey);
        const confirmed = confirmation.kind === 'valid'
            && confirmation.record?.ownerId === ownerId
            && confirmation.record?.leaseId === currentLeaseId
            && confirmation.record.expiresAt > now();
        setLeader(confirmed);
        if (!confirmed) currentLeaseId = null;
        return confirmed;
    };

    const runElection = () => {
        const observedEpoch = lifecycleEpoch;
        const observedKey = storageKey;
        return enqueue(async () => {
            if (!isCurrentInvocation(observedEpoch, observedKey)) return false;
            return leader
                ? renew(observedEpoch, observedKey)
                : acquire(observedEpoch, observedKey);
        });
    };

    const handleStorage = (event) => {
        if (started && event?.key === storageKey) void runElection();
    };

    const attachListener = () => {
        if (listenerAttached || typeof eventTarget?.addEventListener !== 'function') return;
        eventTarget.addEventListener('storage', handleStorage);
        listenerAttached = true;
    };

    const detachListener = () => {
        if (!listenerAttached || typeof eventTarget?.removeEventListener !== 'function') return;
        eventTarget.removeEventListener('storage', handleStorage);
        listenerAttached = false;
    };

    const startMonitor = () => {
        if (monitorTimer !== null) return;
        monitorTimer = setIntervalImpl(() => {
            void runElection();
        }, renewIntervalMs);
    };

    const stopMonitor = () => {
        if (monitorTimer === null) return;
        clearIntervalImpl(monitorTimer);
        monitorTimer = null;
    };

    const releaseOwnLease = (key) => {
        if (!key) return;
        const state = readAt(key);
        const record = state.kind === 'valid' ? state.record : null;
        if (!record || record.ownerId !== ownerId) return;
        writeAt(key, {
            version: MARKET_REFRESH_LEASE_VERSION,
            ownerId: null,
            leaseId: null,
            expiresAt: 0,
            lastActionAt: record.lastActionAt,
            actionClaimId: record.actionClaimId,
        });
    };

    const stop = () => {
        const previousKey = storageKey;
        lifecycleEpoch += 1;
        started = false;
        stopMonitor();
        detachListener();
        releaseOwnLease(previousKey);
        storageKey = null;
        currentLeaseId = null;
        setLeader(false);
    };

    const start = async (token) => {
        let nextScopeKey;
        try {
            nextScopeKey = deriveScopeKey(token);
        } catch (error) {
            safeLogger.error?.('[Market refresh leadership] session scope unavailable', error);
            stop();
            return false;
        }
        if (!isNonEmptyString(nextScopeKey)) {
            stop();
            return false;
        }

        const nextStorageKey = `${MARKET_REFRESH_LEASE_STORAGE_KEY}${nextScopeKey}`;
        if (started && storageKey === nextStorageKey) return runElection();

        stop();
        lifecycleEpoch += 1;
        started = true;
        storageKey = nextStorageKey;
        attachListener();
        startMonitor();
        return runElection();
    };

    const claimAutomaticAction = (minimumIntervalMs) => {
        const observedEpoch = lifecycleEpoch;
        const observedKey = storageKey;
        return enqueue(async () => {
            if (
                !isCurrentInvocation(observedEpoch, observedKey)
                || !leader
                || !currentLeaseId
                || !Number.isFinite(minimumIntervalMs)
                || minimumIntervalMs < 0
            ) return false;

            const state = readAt(observedKey);
            const record = state.kind === 'valid' ? state.record : null;
            const currentTime = now();
            if (
                !record
                || record.ownerId !== ownerId
                || record.leaseId !== currentLeaseId
                || record.expiresAt <= currentTime
            ) {
                loseLeadership();
                return false;
            }
            if (
                record.lastActionAt !== null
                && currentTime - record.lastActionAt < minimumIntervalMs
            ) return false;

            const actionClaimId = randomId();
            if (!isNonEmptyString(actionClaimId)) return false;
            const claimed = {
                ...record,
                expiresAt: currentTime + leaseTtlMs,
                lastActionAt: currentTime,
                actionClaimId,
            };
            if (!writeAt(observedKey, claimed)) {
                loseLeadership();
                return false;
            }

            await delay(settleMs);
            if (!isCurrentInvocation(observedEpoch, observedKey) || !leader) return false;

            const confirmation = readAt(observedKey);
            const confirmed = confirmation.kind === 'valid'
                && confirmation.record?.ownerId === ownerId
                && confirmation.record?.leaseId === currentLeaseId
                && confirmation.record?.actionClaimId === actionClaimId
                && confirmation.record?.lastActionAt === currentTime
                && confirmation.record.expiresAt > now();
            if (!confirmed) loseLeadership();
            return confirmed;
        });
    };

    return {
        start,
        stop,
        runElection,
        claimAutomaticAction,
        isLeader: () => leader,
        isStarted: () => started,
        getStorageKey: () => storageKey,
        getOwnerId: () => ownerId,
    };
};
