const DIVIDEND_EVENT_IDEMPOTENCY_PREFIX = 'dividend.v1.';
const DIVIDEND_EVENT_VERSION = 1;
const SYMBOL_RE = /^[A-Z0-9.^=\-]{1,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIVIDEND_EVENT_KEY_RE = /^dividend\.v1\.[0-9a-f]{64}$/;

const normalizeSymbol = (value) => {
  if (typeof value !== 'string') return '';
  const symbol = value.trim().toUpperCase();
  return SYMBOL_RE.test(symbol) ? symbol : '';
};

const normalizeDate = (value) => {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!DATE_RE.test(text)) return '';

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return '';
  }
  return text;
};

export const normalizeDividendEventIdentity = ({ symbol, date } = {}) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedDate = normalizeDate(date);
  if (!normalizedSymbol || !normalizedDate) return null;
  return Object.freeze({
    version: DIVIDEND_EVENT_VERSION,
    symbol: normalizedSymbol,
    date: normalizedDate,
  });
};

export const buildDividendEventKey = (event = {}) => {
  const identity = normalizeDividendEventIdentity(event);
  return identity ? `${identity.symbol}_${identity.date}` : null;
};

const canonicalDividendEventMaterial = (event = {}) => {
  const identity = normalizeDividendEventIdentity(event);
  if (!identity) throw new Error('Dividend event identity is invalid');
  return JSON.stringify([
    'dividend-event',
    identity.version,
    identity.symbol,
    identity.date,
  ]);
};

const sha256Hex = async (value) => {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error('Secure digest is unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('');
};

export const buildDividendEventIdempotencyKey = async (event = {}) => (
  `${DIVIDEND_EVENT_IDEMPOTENCY_PREFIX}${await sha256Hex(canonicalDividendEventMaterial(event))}`
);

export const isDividendEventIdempotencyKey = value => (
  typeof value === 'string' && DIVIDEND_EVENT_KEY_RE.test(value)
);

export const matchesDividendEventIdempotencyKey = async (value, event = {}) => {
  if (!isDividendEventIdempotencyKey(value)) return false;
  return value === await buildDividendEventIdempotencyKey(event);
};

export const __test = Object.freeze({
  canonicalDividendEventMaterial,
  normalizeSymbol,
  normalizeDate,
  DIVIDEND_EVENT_IDEMPOTENCY_PREFIX,
});
