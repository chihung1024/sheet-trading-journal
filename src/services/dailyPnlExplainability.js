const ROW_RECONCILIATION_TOLERANCE_TWD = 0.01;
const SUMMARY_RECONCILIATION_TOLERANCE_TWD = 0.51;
const VISIBLE_COMPONENT_EPSILON_TWD = 0.005;

const COMPONENTS = Object.freeze([
  Object.freeze({ key: 'price_pnl_twd', label: '價格' }),
  Object.freeze({ key: 'fx_pnl_twd', label: '匯率' }),
  Object.freeze({ key: 'dividend_income_twd', label: '配息' }),
  Object.freeze({ key: 'execution_pnl_twd', label: '交易執行' }),
  Object.freeze({ key: 'fee_tax_pnl_twd', label: '費稅' }),
]);

const unavailable = (reason) => Object.freeze({
  status: 'unavailable',
  reason,
  rows: Object.freeze([]),
  componentTotals: Object.freeze([]),
  rawTotalTwd: null,
  publishedTotalTwd: null,
});

const finiteNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

const normalizeSymbol = (value) => {
  const symbol = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return symbol && symbol.length <= 24 ? symbol : null;
};

const normalizeCurrency = (value) => {
  const currency = typeof value === 'string' ? value.trim() : '';
  return currency && currency.length <= 8 ? currency : '';
};

const buildComponent = (definition, value) => Object.freeze({
  key: definition.key,
  label: definition.label,
  valueTwd: value,
});

const normalizeRow = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const symbol = normalizeSymbol(raw.symbol);
  const total = finiteNumber(raw.total_pnl_twd);
  if (!symbol || total === null) return null;

  const componentValues = new Map();
  for (const definition of COMPONENTS) {
    const value = finiteNumber(raw[definition.key]);
    if (value === null) return null;
    componentValues.set(definition.key, value);
  }

  const componentSum = [...componentValues.values()]
    .reduce((sum, value) => sum + value, 0);
  if (Math.abs(componentSum - total) > ROW_RECONCILIATION_TOLERANCE_TWD) {
    return null;
  }

  const visibleComponents = COMPONENTS
    .map(definition => buildComponent(definition, componentValues.get(definition.key)))
    .filter(component => Math.abs(component.valueTwd) > VISIBLE_COMPONENT_EPSILON_TWD);

  return Object.freeze({
    symbol,
    currency: normalizeCurrency(raw.currency),
    totalPnlTwd: total,
    components: Object.freeze(visibleComponents),
  });
};

export function selectCurrentGroupDayLedger({ rawData, currentGroup = 'all' } = {}) {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return [];

  const groups = rawData.groups;
  if (groups && typeof groups === 'object' && !Array.isArray(groups)) {
    const selected = groups[currentGroup];
    return Array.isArray(selected?.day_ledger) ? selected.day_ledger : [];
  }

  if (currentGroup === 'all' && Array.isArray(rawData.day_ledger)) {
    return rawData.day_ledger;
  }
  return [];
}

export function buildDailyPnlExplanation({ dayLedger, summary } = {}) {
  if (!Array.isArray(dayLedger) || dayLedger.length === 0) {
    return unavailable('missing_day_ledger');
  }
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return unavailable('missing_summary');
  }

  const publishedTotal = finiteNumber(summary.daily_pnl_twd);
  if (publishedTotal === null) return unavailable('invalid_published_total');

  const normalizedRows = [];
  for (const raw of dayLedger) {
    const row = normalizeRow(raw);
    if (!row) return unavailable('invalid_day_ledger');
    normalizedRows.push(row);
  }

  const rawTotal = normalizedRows.reduce((sum, row) => sum + row.totalPnlTwd, 0);
  if (Math.abs(rawTotal - publishedTotal) > SUMMARY_RECONCILIATION_TOLERANCE_TWD) {
    return unavailable('summary_mismatch');
  }

  const rows = normalizedRows
    .slice()
    .sort((left, right) => {
      const magnitude = Math.abs(right.totalPnlTwd) - Math.abs(left.totalPnlTwd);
      if (magnitude !== 0) return magnitude;
      return left.symbol.localeCompare(right.symbol);
    });

  const componentTotals = COMPONENTS.map((definition) => {
    const valueTwd = dayLedger.reduce(
      (sum, raw) => sum + raw[definition.key],
      0,
    );
    return buildComponent(definition, valueTwd);
  }).filter(component => Math.abs(component.valueTwd) > VISIBLE_COMPONENT_EPSILON_TWD);

  return Object.freeze({
    status: 'ready',
    reason: null,
    rows: Object.freeze(rows),
    componentTotals: Object.freeze(componentTotals),
    rawTotalTwd: rawTotal,
    publishedTotalTwd: publishedTotal,
  });
}

export const __test = Object.freeze({
  COMPONENTS,
  ROW_RECONCILIATION_TOLERANCE_TWD,
  SUMMARY_RECONCILIATION_TOLERANCE_TWD,
  VISIBLE_COMPONENT_EPSILON_TWD,
});
