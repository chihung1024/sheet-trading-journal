import { buildDividendAttention } from './dividendAttention.js';
import { isTwrSummaryAvailable } from './twrState.js';

const finiteNumber = value => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const selectDriver = (rows, predicate, compare) => {
  let selected = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    const value = finiteNumber(row?.totalPnlTwd);
    if (value === null || !predicate(value)) continue;
    if (!selected || compare(value, selected.totalPnlTwd)) selected = row;
  }
  return selected;
};

const summarizeDriver = row => (
  row
    ? Object.freeze({
      symbol: String(row.symbol || ''),
      currency: String(row.currency || ''),
      totalPnlTwd: row.totalPnlTwd,
    })
    : null
);

const xirrAvailable = status => status == null || status === 'ok';

export const buildOverviewProjection = ({
  stats = {},
  dailyExplanation = {},
  concentration = {},
  pendingDividends = [],
  records = [],
} = {}) => {
  const publishedDailyPnl = finiteNumber(dailyExplanation?.publishedTotalTwd);
  const dailyReady = dailyExplanation?.status === 'ready'
    && Array.isArray(dailyExplanation.rows)
    && publishedDailyPnl !== null;
  const dailyRows = dailyReady ? dailyExplanation.rows : [];
  const contributor = selectDriver(dailyRows, value => value > 0, (value, current) => value > current);
  const detractor = selectDriver(dailyRows, value => value < 0, (value, current) => value < current);

  const marketValue = finiteNumber(stats?.total_value);
  const holdingCost = finiteNumber(stats?.invested_capital);
  const totalPnl = finiteNumber(stats?.total_pnl);
  const realizedPnl = finiteNumber(stats?.realized_pnl);
  const unrealizedPnl = totalPnl !== null && realizedPnl !== null ? totalPnl - realizedPnl : null;
  const unrealizedReturnPercent = unrealizedPnl !== null && holdingCost !== null && holdingCost > 0
    ? (unrealizedPnl / holdingCost) * 100
    : null;

  const publishedDailyReturn = finiteNumber(stats?.daily_pnl_roi_percent);
  const dailyBaseValue = finiteNumber(stats?.daily_pnl_base_value);
  const dailyReturnPercent = publishedDailyReturn !== null
    ? publishedDailyReturn
    : dailyReady && dailyBaseValue !== null && dailyBaseValue > 0
      ? (publishedDailyPnl / dailyBaseValue) * 100
      : null;

  const twrStatus = stats?.twr_status ?? null;
  const twrReady = isTwrSummaryAvailable(twrStatus) && finiteNumber(stats?.twr) !== null;
  const xirrStatus = stats?.xirr_status ?? null;
  const xirrReady = xirrAvailable(xirrStatus) && finiteNumber(stats?.xirr) !== null;

  const concentrationReady = concentration?.status === 'ok';
  const dividendAttention = buildDividendAttention({ pendingDividends, records });

  return Object.freeze({
    headline: Object.freeze({
      marketValue,
      holdingCost,
      totalPnl,
      unrealizedPnl,
      unrealizedReturnPercent,
      realizedPnl,
      daily: Object.freeze({
        status: dailyReady ? 'ready' : 'unavailable',
        pnlTwd: dailyReady ? publishedDailyPnl : null,
        returnPercent: dailyReady ? dailyReturnPercent : null,
      }),
      twr: Object.freeze({
        status: twrReady ? 'ready' : 'unavailable',
        value: twrReady ? stats.twr : null,
        sourceStatus: twrStatus,
        invalidSince: stats?.twr_invalid_since || '',
      }),
      xirr: Object.freeze({
        status: xirrReady ? 'ready' : 'unavailable',
        value: xirrReady ? stats.xirr : null,
        sourceStatus: xirrStatus,
        conventional: stats?.xirr_cashflow_conventional !== false,
        asOfDate: stats?.xirr_asof_date || '',
      }),
    }),
    context: Object.freeze({
      daily: Object.freeze({
        status: dailyReady ? 'ready' : 'unavailable',
        contributor: summarizeDriver(contributor),
        detractor: summarizeDriver(detractor),
      }),
      concentration: Object.freeze({
        status: concentrationReady ? 'ready' : 'unavailable',
        largest: concentrationReady ? concentration.largest : null,
        top3Weight: concentrationReady ? concentration.top3Weight : null,
        positionCount: concentrationReady ? concentration.positionCount : 0,
      }),
    }),
    attention: Object.freeze({
      dividends: Object.freeze({
        status: dividendAttention.status,
        count: dividendAttention.count,
        next: dividendAttention.next,
      }),
    }),
  });
};
