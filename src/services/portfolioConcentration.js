const normalizeSymbol = value => String(value || '').trim().toUpperCase();

const unavailable = reason => Object.freeze({
  status: 'unavailable',
  reason,
  totalMarketValueTwd: null,
  positionCount: 0,
  largest: null,
  top3Weight: null,
  topPositions: [],
  weightsBySymbol: Object.freeze({}),
});

const notApplicable = () => Object.freeze({
  status: 'not_applicable',
  reason: 'NO_POSITIVE_HOLDINGS',
  totalMarketValueTwd: 0,
  positionCount: 0,
  largest: null,
  top3Weight: 0,
  topPositions: [],
  weightsBySymbol: Object.freeze({}),
});

export const buildPortfolioConcentrationSnapshot = (
  holdings = [],
  expectedTotalValueTwd = null,
  { topCount = 5 } = {},
) => {
  if (!Array.isArray(holdings)) return unavailable('INVALID_HOLDINGS');

  const expectedTotal = Number(expectedTotalValueTwd);
  if (!Number.isFinite(expectedTotal) || expectedTotal < 0) {
    return unavailable('INVALID_SUMMARY_TOTAL');
  }

  const seen = new Set();
  const positions = [];
  let total = 0;

  for (const holding of holdings) {
    const symbol = normalizeSymbol(holding?.symbol);
    if (!symbol) return unavailable('INVALID_SYMBOL');
    if (seen.has(symbol)) return unavailable('DUPLICATE_SYMBOL');
    seen.add(symbol);

    const marketValue = Number(holding?.market_value_twd);
    if (!Number.isFinite(marketValue) || marketValue < 0) {
      return unavailable('INVALID_MARKET_VALUE');
    }
    if (marketValue <= 0) continue;

    total += marketValue;
    positions.push({ symbol, marketValueTwd: marketValue });
  }

  if (positions.length === 0) {
    return expectedTotal === 0 ? notApplicable() : unavailable('TOTAL_MISMATCH');
  }

  const tolerance = Math.max(1, Math.abs(expectedTotal) * 1e-9);
  if (Math.abs(total - expectedTotal) > tolerance) {
    return unavailable('TOTAL_MISMATCH');
  }

  positions.sort((left, right) => (
    right.marketValueTwd - left.marketValueTwd
    || left.symbol.localeCompare(right.symbol)
  ));

  const weightsBySymbol = Object.create(null);
  const weighted = positions.map(position => {
    const weight = (position.marketValueTwd / total) * 100;
    weightsBySymbol[position.symbol] = weight;
    return Object.freeze({ ...position, weight });
  });

  const boundedTopCount = Number.isSafeInteger(topCount) && topCount > 0 ? topCount : 5;
  const topPositions = Object.freeze(weighted.slice(0, boundedTopCount));
  const top3Weight = weighted.slice(0, 3).reduce((sum, position) => sum + position.weight, 0);

  return Object.freeze({
    status: 'ok',
    reason: '',
    totalMarketValueTwd: total,
    positionCount: weighted.length,
    largest: weighted[0] || null,
    top3Weight,
    topPositions,
    weightsBySymbol: Object.freeze(weightsBySymbol),
  });
};

export const getHoldingWeight = (snapshot, symbol) => {
  if (snapshot?.status !== 'ok') return null;
  const key = normalizeSymbol(symbol);
  if (!key) return null;
  const weight = snapshot.weightsBySymbol?.[key];
  return Number.isFinite(weight) ? weight : 0;
};
