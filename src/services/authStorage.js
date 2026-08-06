import {
    EMAIL_STORAGE_KEY,
    NAME_STORAGE_KEY,
    TOKEN_STORAGE_KEY,
} from './projectStorage.js';

const AUTH_STORAGE_KEYS = Object.freeze([
    TOKEN_STORAGE_KEY,
    NAME_STORAGE_KEY,
    EMAIL_STORAGE_KEY,
]);

const requireStorage = (storage) => {
    if (
        !storage
        || typeof storage.getItem !== 'function'
        || typeof storage.setItem !== 'function'
        || typeof storage.removeItem !== 'function'
    ) {
        throw new TypeError('A readable and writable Storage-compatible object is required');
    }
    return storage;
};

const requireString = (value, label, { allowEmpty = false } = {}) => {
    if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
    if (!allowEmpty && !value.trim()) throw new TypeError(`${label} is required`);
    return allowEmpty ? value : value.trim();
};

export const persistAuthentication = (storage, authenticated) => {
    const target = requireStorage(storage);
    const token = requireString(authenticated?.token, 'Authentication token');
    const name = requireString(authenticated?.user?.name ?? '', 'Authentication name', {
        allowEmpty: true,
    });
    const email = requireString(authenticated?.user?.email, 'Authentication email').toLowerCase();

    const nextValues = new Map([
        [TOKEN_STORAGE_KEY, token],
        [NAME_STORAGE_KEY, name],
        [EMAIL_STORAGE_KEY, email],
    ]);
    const previousValues = new Map();

    for (const key of AUTH_STORAGE_KEYS) {
        previousValues.set(key, target.getItem(key));
    }

    try {
        for (const key of AUTH_STORAGE_KEYS) {
            target.setItem(key, nextValues.get(key));
        }
    } catch (cause) {
        const rollbackFailures = [];
        for (const key of AUTH_STORAGE_KEYS) {
            try {
                const previous = previousValues.get(key);
                if (previous === null) target.removeItem(key);
                else target.setItem(key, previous);
            } catch (error) {
                rollbackFailures.push({ key, error });
            }
        }

        const failure = new Error('Failed to persist authentication state', { cause });
        failure.name = 'AuthenticationStorageError';
        failure.rollbackFailures = rollbackFailures;
        throw failure;
    }

    return {
        token,
        user: {
            name,
            email,
        },
    };
};

export const readAuthenticationStorage = (storage) => {
    const target = requireStorage(storage);
    return {
        token: target.getItem(TOKEN_STORAGE_KEY),
        name: target.getItem(NAME_STORAGE_KEY),
        email: target.getItem(EMAIL_STORAGE_KEY),
    };
};
