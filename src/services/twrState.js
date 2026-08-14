const KNOWN_TWR_STATUSES = new Set(['ok', 'not_applicable', 'undefined']);

export function isTwrSummaryAvailable(status) {
  // Legacy snapshots have no status and retain their historical numeric display.
  return status == null || status === 'ok';
}

export function isTwrPointReliable(point) {
  if (!point || point.twr == null) return false;
  const status = point.twr_status;
  if (status == null) return Number.isFinite(Number(point.twr));
  return status === 'ok' && Number.isFinite(Number(point.twr));
}

export function relativeTwrValue(point, baseline) {
  if (!isTwrPointReliable(point)) return null;

  const baselineStatus = baseline?.twr_status;
  if (baselineStatus != null && !KNOWN_TWR_STATUSES.has(baselineStatus)) return null;
  if (baselineStatus === 'undefined') return null;
  if (baselineStatus !== 'not_applicable' && !isTwrPointReliable(baseline)) return null;

  const pointValue = Number(point.twr);
  const baselineValue = baselineStatus === 'not_applicable'
    ? 0
    : Number(baseline.twr);
  if (!Number.isFinite(pointValue) || !Number.isFinite(baselineValue)) return null;

  const denominator = 1 + baselineValue / 100;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return null;

  const relative = ((1 + pointValue / 100) / denominator - 1) * 100;
  return Number.isFinite(relative) ? relative : null;
}

const relativeBenchmarkValue = (point, baseline) => {
  if (point?.benchmark_twr == null || baseline?.benchmark_twr == null) return null;
  if (typeof point.benchmark_twr === 'boolean' || typeof baseline.benchmark_twr === 'boolean') return null;

  const pointValue = Number(point.benchmark_twr);
  const baselineValue = Number(baseline.benchmark_twr);
  if (!Number.isFinite(pointValue) || !Number.isFinite(baselineValue)) return null;

  const denominator = 1 + baselineValue / 100;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return null;

  const relative = ((1 + pointValue / 100) / denominator - 1) * 100;
  return Number.isFinite(relative) ? relative : null;
};

export function buildComparableTwrComparison(history) {
  const rows = Array.isArray(history) ? history : [];
  const anchorIndex = rows.findIndex(row => (
    isTwrPointReliable(row)
    && relativeBenchmarkValue(row, row) !== null
  ));

  if (anchorIndex < 0) {
    return Object.freeze({
      anchor: null,
      rows: Object.freeze([]),
      strategy: Object.freeze([]),
      benchmark: Object.freeze([]),
    });
  }

  const anchor = rows[anchorIndex];
  const comparableRows = rows.slice(anchorIndex);
  return Object.freeze({
    anchor,
    rows: Object.freeze(comparableRows),
    strategy: Object.freeze(comparableRows.map(row => relativeTwrValue(row, anchor))),
    benchmark: Object.freeze(comparableRows.map(row => (
      isTwrPointReliable(row) ? relativeBenchmarkValue(row, anchor) : null
    ))),
  });
}

export function firstTwrInvalidDate(history) {
  for (const row of history || []) {
    if (row?.twr_status === 'undefined') {
      return row.twr_invalid_since || row.date || null;
    }
  }
  return null;
}

export function lastFiniteSeriesIndex(values) {
  for (let index = (values?.length ?? 0) - 1; index >= 0; index -= 1) {
    const rawValue = values[index];
    if (rawValue == null) continue;
    if (Number.isFinite(Number(rawValue))) return index;
  }
  return -1;
}
