const CURRENCY_RULES = Object.freeze([
  ['TWD', Object.freeze(['.TW', '.TWO'])],
  ['KRW', Object.freeze(['.KS', '.KQ'])],
  ['HKD', Object.freeze(['.HK', '.HKG'])],
  ['CNY', Object.freeze(['.SS', '.SZ'])],
  ['JPY', Object.freeze(['.T'])],
  ['GBp', Object.freeze(['.L'])],
  ['EUR', Object.freeze(['.PA', '.DE'])],
]);

const CURRENCY_AFFIXES = Object.freeze({
  TWD: Object.freeze({ prefix: 'NT$', suffix: '' }),
  USD: Object.freeze({ prefix: '$', suffix: '' }),
  KRW: Object.freeze({ prefix: '₩', suffix: '' }),
  HKD: Object.freeze({ prefix: 'HK$', suffix: '' }),
  CNY: Object.freeze({ prefix: 'CN¥', suffix: '' }),
  JPY: Object.freeze({ prefix: '¥', suffix: '' }),
  GBp: Object.freeze({ prefix: '', suffix: ' GBp' }),
  EUR: Object.freeze({ prefix: '€', suffix: '' }),
});

export const NATIVE_CURRENCY_OPTIONS = Object.freeze([
  'USD',
  'TWD',
  'JPY',
  'KRW',
  'HKD',
  'CNY',
  'EUR',
  'GBP',
  'GBp',
]);

export const normalizeNativeCurrency = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (trimmed === 'GBp') return 'GBp';
  const normalized = trimmed.toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : '';
};

export const detectNativeCurrency = (symbol) => {
  const normalized = String(symbol || '').trim().toUpperCase();
  for (const [currency, suffixes] of CURRENCY_RULES) {
    if (suffixes.some(suffix => normalized.endsWith(suffix))) return currency;
  }
  return 'USD';
};

export const getCurrencyInputAffix = (currency) => {
  const normalized = normalizeNativeCurrency(currency) || String(currency || '').trim();
  const affix = CURRENCY_AFFIXES[normalized];
  if (!affix) return normalized;
  return affix.prefix || normalized;
};

export const formatNativeAmount = (amount, currency, fractionDigits = 2) => {
  if (
    amount === null
    || amount === undefined
    || typeof amount === 'boolean'
    || (typeof amount === 'string' && amount.trim() === '')
  ) return '—';

  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '—';

  const digits = Number.isInteger(fractionDigits) && fractionDigits >= 0
    ? fractionDigits
    : 2;
  const formatted = numeric.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const normalized = normalizeNativeCurrency(currency) || String(currency || '').trim();
  const affix = CURRENCY_AFFIXES[normalized];
  if (!affix) return `${formatted} ${normalized || ''}`.trim();
  return `${affix.prefix}${formatted}${affix.suffix}`;
};

export const canConvertWithLegacyUsdTwdRate = (currency) => (
  normalizeNativeCurrency(currency) === 'TWD' || normalizeNativeCurrency(currency) === 'USD'
);