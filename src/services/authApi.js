import { readApiJson } from './apiResponse.js';
import {
    DEFAULT_REQUEST_TIMEOUT_MS,
    fetchWithDeadline,
} from './fetchDeadline.js';
import { MalformedApiResponseError } from './requestErrors.js';
import { decodeJwtClaims } from './jwtClaims.js';

const AUTH_TOKEN_MIN_REMAINING_SECONDS = 300;

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

const normalizeEmail = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new MalformedApiResponseError(`${label} is required`);
    }
    return value.trim().toLowerCase();
};

const validateAuthenticatedToken = (
    token,
    responseEmail,
    {
        nowMs,
        atobImpl,
        TextDecoderImpl,
    },
) => {
    if (!Number.isFinite(nowMs) || nowMs < 0) {
        throw new TypeError('Current time must be finite and non-negative');
    }

    let claims;
    try {
        claims = decodeJwtClaims(token, { atobImpl, TextDecoderImpl });
    } catch (error) {
        throw new MalformedApiResponseError('Authentication token claims are invalid', {
            cause: error,
        });
    }

    const secondsRemaining = claims.exp - Math.floor(nowMs / 1000);
    if (secondsRemaining < AUTH_TOKEN_MIN_REMAINING_SECONDS) {
        throw new MalformedApiResponseError('Authentication token is expired or too close to expiry');
    }

    const signedEmail = normalizeEmail(claims.email, 'Authentication token email claim');
    if (signedEmail !== responseEmail) {
        throw new MalformedApiResponseError(
            'Authentication response email does not match the signed token identity',
        );
    }

    return claims;
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
    const normalizedBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');
    const payload = await fetchWithDeadline(
        `${normalizedBaseUrl}${endpoint}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id_token: googleCredential.trim() }),
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
    const responseEmail = normalizeEmail(readRequiredString(payload, 'email'), 'Authentication response email');
    const claims = validateAuthenticatedToken(token, responseEmail, {
        nowMs,
        atobImpl,
        TextDecoderImpl,
    });
    const picture = typeof payload.picture === 'string' && payload.picture.trim()
        ? payload.picture.trim()
        : (typeof claims.picture === 'string' ? claims.picture : '');

    return {
        token,
        user: {
            name,
            email: responseEmail,
            picture,
        },
    };
};
