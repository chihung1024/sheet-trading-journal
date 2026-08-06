import {
    ApiApplicationError,
    ApiHttpError,
    MalformedApiResponseError,
} from './requestErrors.js';

const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const readSafeString = (value) => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const getApiMessage = (payload, fallback) => (
    readSafeString(payload?.error)
    || readSafeString(payload?.message)
    || fallback
);

const getApiCode = (payload) => (
    readSafeString(payload?.error_meta?.code)
    || readSafeString(payload?.error_code)
    || readSafeString(payload?.code)
    || null
);

export const readApiJson = async (response, { endpoint = 'API' } = {}) => {
    if (!response || typeof response.json !== 'function' || typeof response.ok !== 'boolean') {
        throw new MalformedApiResponseError(`${endpoint} returned an invalid Response object`);
    }

    let payload;
    try {
        payload = await response.json();
    } catch (error) {
        if (!response.ok) {
            throw new ApiHttpError(`API Error: ${response.status}`, {
                status: response.status,
            });
        }
        throw new MalformedApiResponseError(
            `${endpoint} returned invalid JSON`,
            { cause: error },
        );
    }

    if (!isPlainObject(payload)) {
        if (!response.ok) {
            throw new ApiHttpError(`API Error: ${response.status}`, {
                status: response.status,
            });
        }
        throw new MalformedApiResponseError(`${endpoint} returned a non-object payload`);
    }

    if (!response.ok) {
        throw new ApiHttpError(
            getApiMessage(payload, `API Error: ${response.status}`),
            {
                status: response.status,
                apiCode: getApiCode(payload),
            },
        );
    }

    if (payload.success === false) {
        throw new ApiApplicationError(
            getApiMessage(payload, `${endpoint} reported failure`),
            { apiCode: getApiCode(payload) },
        );
    }

    if (payload.success !== true) {
        throw new MalformedApiResponseError(
            `${endpoint} did not provide explicit success evidence`,
        );
    }

    return payload;
};
