export class RequestTimeoutError extends Error {
    constructor(timeoutMs, options = {}) {
        super(`Request timed out after ${timeoutMs}ms`, options.cause ? { cause: options.cause } : undefined);
        this.name = 'RequestTimeoutError';
        this.code = 'REQUEST_TIMEOUT';
        this.timeoutMs = timeoutMs;
        this.outcomeAmbiguous = false;
    }
}

export class RequestAbortedError extends Error {
    constructor(options = {}) {
        super('Request was aborted', options.cause ? { cause: options.cause } : undefined);
        this.name = 'RequestAbortedError';
        this.code = 'REQUEST_ABORTED';
        this.reason = options.reason;
        this.outcomeAmbiguous = false;
    }
}

export class ApiHttpError extends Error {
    constructor(message, { status, apiCode = null } = {}) {
        super(message);
        this.name = 'ApiHttpError';
        this.code = 'API_HTTP_ERROR';
        this.status = status;
        this.apiCode = apiCode;
        this.outcomeAmbiguous = false;
    }
}

export class ApiApplicationError extends Error {
    constructor(message, { apiCode = null } = {}) {
        super(message);
        this.name = 'ApiApplicationError';
        this.code = 'API_APPLICATION_ERROR';
        this.apiCode = apiCode;
        this.outcomeAmbiguous = false;
    }
}

export class MalformedApiResponseError extends Error {
    constructor(message = 'API returned a malformed response', options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = 'MalformedApiResponseError';
        this.code = 'MALFORMED_API_RESPONSE';
        this.outcomeAmbiguous = false;
    }
}

export const normalizeRequestMethod = (method = 'GET') => String(method || 'GET').toUpperCase();

export const isMutationMethod = (method = 'GET') => !['GET', 'HEAD', 'OPTIONS'].includes(
    normalizeRequestMethod(method),
);

export const markRequestOutcome = (error, method = 'GET') => {
    if (error instanceof RequestTimeoutError && isMutationMethod(method)) {
        error.outcomeAmbiguous = true;
    }
    return error;
};

export const isExplicitServerRejection = (error) => (
    error instanceof ApiHttpError || error instanceof ApiApplicationError
);

export const formatRequestError = (
    error,
    { action = '請求', method = 'GET', fallback = `${action}失敗` } = {},
) => {
    if (error instanceof RequestTimeoutError) {
        if (isMutationMethod(method)) {
            return `${action}逾時，伺服器可能已完成操作。請先重新整理確認結果，再決定是否重試。`;
        }
        return `${action}逾時，請稍後重試。`;
    }
    if (error instanceof RequestAbortedError) return `${action}已取消。`;
    if (error instanceof MalformedApiResponseError) return `${action}失敗：伺服器回應格式不正確。`;
    return error?.message || fallback;
};
