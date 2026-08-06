import { readApiJson } from './apiResponse.js';
import {
    DEFAULT_REQUEST_TIMEOUT_MS,
    fetchWithDeadline,
} from './fetchDeadline.js';
import { MalformedApiResponseError } from './requestErrors.js';
import { isJwtExpired } from './jwtClaims.js';

const readRequiredString = (payload, key, { allowEmpty = false } = {}) => {
    const value = payload?.[key];
    if (typeof value !== 'string') {
        throw new MalformedApiResponseError(`Authentication response field ${key} must be a string`);
    }
    const normalized = value.trim();
    if (!allowEmpty && !normalized) {
        throw new MalformedApiResponseError(`Authentication response field ${key} is required`);
    }
    return allowEmpty ? value : normalized;
};

export const exchangeGoogleCredential = async (
    googleCredential,
    {
        apiBaseUrl,
        timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
        signal = null,
        fetchImpl = globalThis.fetch,
        setTimeoutImpl = globalThis.setTimeout,
        clearTimeoutImpl = globalThis.clearTimeout,
        nowMs = Date.now(),
        atobImpl = globalThis.atob,
        TextDecoderImpl = globalThis.TextDecoder,
    } = {},
) => {
    if (typeof googleCredential !== 'string' || !googleCredential.trim()) {
        throw new TypeError('Google credential is required');
    }
    if (typeof apiBaseUrl !== 'string' || !apiBaseUrl.trim()) {
        throw new TypeError('API base URL is required');
    }

    const endpoint = '/auth/google';
    const payload = await fetchWithDeadline(
        `${apiBaseUrl}${endpoint}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id_token: googleCredential }),
        },
        {
            timeoutMs,
            signal,
            fetchImpl,
            setTimeoutImpl,
            clearTimeoutImpl,
            responseHandler: (response) => readApiJson(response, { endpoint }),
        },
    );

    const token = readRequiredString(payload, 'token');
    const name = readRequiredString(payload, 'user', { allowEmpty: true });
    const email = readRequiredString(payload, 'email');
    const picture = typeof payload.picture === 'string' && payload.picture.trim()
        ? payload.picture.trim()
        : '';

    try {
        if (isJwtExpired(token, {
            nowMs,
            skewSeconds: 300,
            atobImpl,
            TextDecoderImpl,
        })) {
            throw new MalformedApiResponseError('Authentication token is expired or too close to expiry');
        }
    } catch (error) {
        if (error instanceof MalformedApiResponseError) throw error;
        throw new MalformedApiResponseError('Authentication token claims are invalid', { cause: error });
    }

    return {
        token,
        user: {
            name,
            email,
            picture,
        },
    };
};
