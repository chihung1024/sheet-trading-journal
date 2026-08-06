export class JwtClaimsError extends Error {
    constructor(message, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = 'JwtClaimsError';
        this.code = 'JWT_CLAIMS_ERROR';
    }
}

const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const validateCompactSegment = (segment, label, { requireDecodableLength = false } = {}) => {
    if (typeof segment !== 'string' || !segment || !/^[A-Za-z0-9_-]+$/.test(segment)) {
        throw new JwtClaimsError(`JWT ${label} segment is invalid`);
    }
    if (requireDecodableLength && segment.length % 4 === 1) {
        throw new JwtClaimsError(`JWT ${label} segment padding is invalid`);
    }
    return segment;
};

const normalizePayloadSegment = (segment) => {
    const validated = validateCompactSegment(segment, 'payload', {
        requireDecodableLength: true,
    });
    const remainder = validated.length % 4;
    return validated
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(validated.length + ((4 - remainder) % 4), '=');
};

const decodeUtf8 = (binary, TextDecoderImpl) => {
    if (typeof TextDecoderImpl !== 'function') {
        throw new JwtClaimsError('UTF-8 decoder is unavailable');
    }
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    try {
        return new TextDecoderImpl('utf-8', { fatal: true }).decode(bytes);
    } catch (error) {
        throw new JwtClaimsError('JWT payload is not valid UTF-8', { cause: error });
    }
};

export const decodeJwtClaims = (
    token,
    {
        atobImpl = globalThis.atob,
        TextDecoderImpl = globalThis.TextDecoder,
    } = {},
) => {
    if (typeof token !== 'string' || !token.trim()) {
        throw new JwtClaimsError('JWT is missing');
    }
    if (typeof atobImpl !== 'function') {
        throw new JwtClaimsError('Base64 decoder is unavailable');
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) throw new JwtClaimsError('JWT must contain three segments');
    validateCompactSegment(parts[0], 'header');
    validateCompactSegment(parts[2], 'signature');

    let jsonText;
    try {
        jsonText = decodeUtf8(atobImpl(normalizePayloadSegment(parts[1])), TextDecoderImpl);
    } catch (error) {
        if (error instanceof JwtClaimsError) throw error;
        throw new JwtClaimsError('JWT payload cannot be decoded', { cause: error });
    }

    let claims;
    try {
        claims = JSON.parse(jsonText);
    } catch (error) {
        throw new JwtClaimsError('JWT payload is not valid JSON', { cause: error });
    }
    if (!isPlainObject(claims)) throw new JwtClaimsError('JWT claims must be an object');
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= 0) {
        throw new JwtClaimsError('JWT exp claim must be a positive integer');
    }
    return claims;
};

export const getJwtSecondsUntilExpiry = (
    token,
    {
        nowMs = Date.now(),
        ...decodeOptions
    } = {},
) => {
    if (!Number.isFinite(nowMs) || nowMs < 0) {
        throw new JwtClaimsError('Current time must be finite and non-negative');
    }
    const claims = decodeJwtClaims(token, decodeOptions);
    return claims.exp - Math.floor(nowMs / 1000);
};

export const isJwtExpired = (
    token,
    {
        nowMs = Date.now(),
        skewSeconds = 300,
        ...decodeOptions
    } = {},
) => {
    if (!Number.isFinite(skewSeconds) || skewSeconds < 0) {
        throw new JwtClaimsError('JWT expiry skew must be finite and non-negative');
    }
    return getJwtSecondsUntilExpiry(token, { nowMs, ...decodeOptions }) < skewSeconds;
};
