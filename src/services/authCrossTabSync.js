import { TOKEN_STORAGE_KEY } from './projectStorage.js';
import { decodeJwtClaims, isJwtExpired } from './jwtClaims.js';

export const AUTH_STORAGE_EVENT_KIND = Object.freeze({
  IGNORE: 'ignore',
  SIGNED_OUT: 'signed-out',
  TOKEN_REFRESHED: 'token-refreshed',
  SESSION_CHANGED: 'session-changed',
  INVALID: 'invalid',
});

const normalizeSignedEmail = (claims) => {
  if (typeof claims?.email !== 'string' || !claims.email.trim()) {
    throw new Error('Authentication token has no signed tenant email');
  }
  return claims.email.trim().toLowerCase();
};

export function classifyCrossTabAuthEvent(
  event,
  {
    expectedStorage = globalThis.localStorage,
    currentToken = '',
    currentEmail = '',
    nowMs = Date.now(),
    skewSeconds = 300,
    decodeClaims = decodeJwtClaims,
    tokenExpired = isJwtExpired,
  } = {},
) {
  if (!event || event.key !== TOKEN_STORAGE_KEY) {
    return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.IGNORE });
  }

  if (event.storageArea && expectedStorage && event.storageArea !== expectedStorage) {
    return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.IGNORE });
  }

  if (event.newValue === null) {
    return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.SIGNED_OUT });
  }

  if (typeof event.newValue !== 'string' || !event.newValue.trim()) {
    return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.INVALID });
  }

  const nextToken = event.newValue.trim();
  if (nextToken === currentToken) {
    return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.IGNORE });
  }

  try {
    const claims = decodeClaims(nextToken);
    if (tokenExpired(nextToken, { nowMs, skewSeconds })) {
      return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.INVALID });
    }

    const nextEmail = normalizeSignedEmail(claims);
    const normalizedCurrentEmail = typeof currentEmail === 'string'
      ? currentEmail.trim().toLowerCase()
      : '';

    if (!normalizedCurrentEmail || normalizedCurrentEmail !== nextEmail) {
      return Object.freeze({
        kind: AUTH_STORAGE_EVENT_KIND.SESSION_CHANGED,
        token: nextToken,
        email: nextEmail,
        claims,
      });
    }

    return Object.freeze({
      kind: AUTH_STORAGE_EVENT_KIND.TOKEN_REFRESHED,
      token: nextToken,
      email: nextEmail,
      claims,
    });
  } catch {
    return Object.freeze({ kind: AUTH_STORAGE_EVENT_KIND.INVALID });
  }
}
