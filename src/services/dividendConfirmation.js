import { buildDividendEventKey } from '../../shared/dividendEventIdentity.js';

export { buildDividendEventKey } from '../../shared/dividendEventIdentity.js';

export const getPendingDividendEventKey = dividend => buildDividendEventKey({
  symbol: dividend?.symbol,
  date: dividend?.ex_date,
});

export const getDividendRecordEventKey = record => {
  if (String(record?.txn_type || '').trim().toUpperCase() !== 'DIV') return null;
  return buildDividendEventKey({
    symbol: record?.symbol,
    date: record?.txn_date,
  });
};

export const buildConfirmedDividendKeySet = (records = []) => {
  const confirmed = new Set();
  if (!Array.isArray(records)) return confirmed;

  for (const record of records) {
    const key = getDividendRecordEventKey(record);
    if (key) confirmed.add(key);
  }
  return confirmed;
};

export const isDividendConfirmedByRecords = (dividend, confirmedKeys) => {
  const key = getPendingDividendEventKey(dividend);
  return Boolean(key && confirmedKeys instanceof Set && confirmedKeys.has(key));
};
