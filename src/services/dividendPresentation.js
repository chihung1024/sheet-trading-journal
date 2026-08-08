const asFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const inferLegacyCurrency = (symbol = '') => (
  /^\d{4}/.test(String(symbol)) || /\.TW(O)?$/i.test(String(symbol)) ? 'TWD' : 'USD'
);

export const getDividendCurrency = (dividend = {}) => {
  const published = typeof dividend?.currency === 'string'
    ? dividend.currency.trim().toUpperCase()
    : '';
  return published || inferLegacyCurrency(dividend?.symbol);
};

export const getDividendNetNative = (dividend = {}) => {
  if (dividend?.total_net_native !== null && dividend?.total_net_native !== undefined) {
    return asFiniteNumber(dividend.total_net_native);
  }
  return asFiniteNumber(dividend?.total_net_usd);
};

export const getDividendDefaultTax = (dividend = {}) => {
  const gross = asFiniteNumber(dividend?.total_gross);
  const net = getDividendNetNative(dividend);
  return Math.max(0, gross - net);
};
