const KNOWN_TWR_STATUSES = new Set(['ok', 'not_applicable', 'undefined']);

export function isTwrSummaryAvailable(status) {
  // Legacy snapshots have no status and retain their historical numeric display.
  return status == null || status === 'ok';
}

export function isTwrPointReliable(point) {
  if (!point) return false;
  const status = point.twr_status;
  if (status == null) return Number.isFinite(Number(point.twr));
  return status === 'ok' && Number.isFinite(Number(point.twr));
}

export function relativeTwrValue(point, baseline) {
  if (!isTwrPointReliable(point)) return null;

  const baselineStatus = baseline?.twr_status;
  if (baselineStatus != null && !KNOWN_TWR_STATUSES.has(baselineStatus)) return null;
  if (baselineStatus === 'undefined') return null;

  const pointValue = Number(point.twr);
  const baselineValue = baselineStatus === 'not_applicable'
    ? 0
    : Number(baseline?.twr ?? 0);
  if (!Number.isFinite(pointValue) || !Number.isFinite(baselineValue)) return null;

  const denominator = 1 + baselineValue / 100;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return null;

  const relative = ((1 + pointValue / 100) / denominator - 1) * 100;
  return Number.isFinite(relative) ? relative : null;
}

export function firstTwrInvalidDate(history) {
  for (const row of history || []) {
    if (row?.twr_status === 'undefined') {
      return row.twr_invalid_since || row.date || null;
    }
  }
  return null;
}
