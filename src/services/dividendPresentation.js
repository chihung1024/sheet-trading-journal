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

export const getDividendEntryAmounts = (dividend = {}) => {
  const gross = asFiniteNumber(dividend?.amount);
  const tax = asFiniteNumber(dividend?.tax);
  return Object.freeze({
    gross,
    tax,
    net: gross - tax,
  });
};

export const getDividendEntryTaxRate = (dividend = {}) => {
  const { gross, tax } = getDividendEntryAmounts(dividend);
  if (gross <= 0) return 0;
  return Math.round((tax / gross) * 100);
};

export const getDividendEntryValidationError = (dividend = {}) => {
  const rawGross = Number(dividend?.amount);
  const rawTax = Number(dividend?.tax);

  if (!Number.isFinite(rawGross) || rawGross <= 0) {
    return '請輸入大於 0 的稅前配息總額';
  }
  if (!Number.isFinite(rawTax) || rawTax < 0) {
    return '預扣稅金不可小於 0';
  }
  if (rawTax > rawGross) {
    return '預扣稅金不可大於稅前配息總額';
  }
  return '';
};
