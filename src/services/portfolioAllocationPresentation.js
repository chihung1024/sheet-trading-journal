const unavailable = reason => Object.freeze({
  status: 'unavailable',
  reason,
  segments: Object.freeze([]),
  positionCount: 0,
  top3Weight: null,
});

export const buildPortfolioAllocationDonutModel = (
  concentration,
  { maxNamedSegments = 7 } = {},
) => {
  if (concentration?.status !== 'ok') {
    return unavailable('CONCENTRATION_NOT_READY');
  }

  const weights = concentration.weightsBySymbol;
  if (!weights || typeof weights !== 'object') {
    return unavailable('MISSING_WEIGHTS');
  }

  const entries = Object.entries(weights).map(([symbol, rawWeight]) => ({
    symbol: String(symbol || '').trim().toUpperCase(),
    weight: Number(rawWeight),
  }));

  if (entries.some(item => !item.symbol || !Number.isFinite(item.weight) || item.weight < 0)) {
    return unavailable('INVALID_WEIGHTS');
  }

  const positive = entries
    .filter(item => item.weight > 0)
    .sort((left, right) => right.weight - left.weight || left.symbol.localeCompare(right.symbol));

  if (positive.length === 0) return unavailable('NO_POSITIVE_WEIGHTS');

  const totalWeight = positive.reduce((sum, item) => sum + item.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.05) {
    return unavailable('WEIGHT_TOTAL_MISMATCH');
  }

  const requested = Number.isSafeInteger(maxNamedSegments) && maxNamedSegments > 0
    ? maxNamedSegments
    : 7;
  const named = positive.slice(0, requested);
  const remainder = positive.slice(requested);
  const collapsed = [...named];

  if (remainder.length > 0) {
    collapsed.push({
      symbol: '其他',
      weight: remainder.reduce((sum, item) => sum + item.weight, 0),
      otherCount: remainder.length,
    });
  }

  let offset = 0;
  const segments = collapsed.map((item, index) => {
    const segment = Object.freeze({
      key: item.symbol === '其他' ? `other-${item.otherCount}` : item.symbol,
      label: item.symbol,
      weight: item.weight,
      offset,
      paletteIndex: index,
      otherCount: item.otherCount || 0,
    });
    offset += item.weight;
    return segment;
  });

  return Object.freeze({
    status: 'ready',
    reason: '',
    segments: Object.freeze(segments),
    positionCount: positive.length,
    top3Weight: Number(concentration.top3Weight),
  });
};
