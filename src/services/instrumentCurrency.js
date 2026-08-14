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

export const detectNativeCurrency = (symbol) => {
  const normalized = String(symbol || '').trim().toUpperCase();
  for (const [currency, suffixes] of CURRENCY_RULES) {
    if (suffixes.some(suffix => normalized.endsWith(suffix))) return currency;
  }
  return 'USD';
};

export const getCurrencyInputAffix = (currency) => {
  const normalized = String(currency || '').trim();
  const affix = CURRENCY_AFFIXES[normalized];
  if (!affix) return normalized;
  return affix.prefix || normalized;
};

export const formatNativeAmount = (amount, currency, fractionDigits = 2) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '—';

  const digits = Number.isInteger(fractionDigits) && fractionDigits >= 0
    ? fractionDigits
    : 2;
  const formatted = numeric.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const normalized = String(currency || '').trim();
  const affix = CURRENCY_AFFIXES[normalized];
  if (!affix) return `${formatted} ${normalized || ''}`.trim();
  return `${affix.prefix}${formatted}${affix.suffix}`;
};

export const canConvertWithLegacyUsdTwdRate = (currency) => (
  currency === 'TWD' || currency === 'USD'
);
