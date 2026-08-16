import { buildDividendAttention } from './dividendAttention.js';
import { recordMatchesHistoryFilters } from './recordHistoryPresentation.js';

const finiteNumber = value => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const selectDriver = (rows, predicate, compare) => {
  let selected = null;
  for (const row of rows) {
    const value = finiteNumber(row?.totalPnlTwd);
    if (value === null || !predicate(value)) continue;
    if (!selected || compare(value, selected.totalPnlTwd)) selected = row;
  }
  return selected;
};

const summarizeDriver = row => {
  if (!row) return null;
  return Object.freeze({
    symbol: String(row.symbol || ''),
    currency: String(row.currency || ''),
    totalPnlTwd: row.totalPnlTwd,
  });
};

const summarizeRecentRecord = record => {
  if (!record) return null;
  return Object.freeze({
    id: record.id ?? null,
    txnDate: String(record.txn_date || ''),
    symbol: String(record.symbol || ''),
    txnType: String(record.txn_type || '').toUpperCase(),
    tag: String(record.tag || ''),
  });
};

export const buildDailyCommandSnapshot = ({
  dailyExplanation,
  concentration,
  pendingDividends = [],
  records = [],
  currentGroup = 'all',
} = {}) => {
  const dailyReady = dailyExplanation?.status === 'ready' && Array.isArray(dailyExplanation.rows);
  const dailyRows = dailyReady ? dailyExplanation.rows : [];
  const contributor = selectDriver(dailyRows, value => value > 0, (value, current) => value > current);
  const detractor = selectDriver(dailyRows, value => value < 0, (value, current) => value < current);

  const concentrationReady = concentration?.status === 'ok';
  const dividendAttention = buildDividendAttention({ pendingDividends, records });

  const recentRecord = Array.isArray(records)
    ? records.find(record => recordMatchesHistoryFilters(record, { currentGroup }))
    : null;

  return Object.freeze({
    daily: Object.freeze({
      status: dailyReady ? 'ready' : 'unavailable',
      publishedTotalTwd: dailyReady ? finiteNumber(dailyExplanation.publishedTotalTwd) : null,
      contributor: summarizeDriver(contributor),
      detractor: summarizeDriver(detractor),
    }),
    concentration: Object.freeze({
      status: concentrationReady ? 'ready' : 'unavailable',
      largest: concentrationReady ? concentration.largest : null,
      top3Weight: concentrationReady ? concentration.top3Weight : null,
      positionCount: concentrationReady ? concentration.positionCount : 0,
    }),
    dividends: Object.freeze({
      status: dividendAttention.status,
      count: dividendAttention.count,
      next: dividendAttention.next,
    }),
    recentRecord: summarizeRecentRecord(recentRecord),
  });
};
