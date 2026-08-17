const RECONCILIATION_TOLERANCE_TWD = 0.51;

const finite = value => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const unavailable = (reason, { hidden = false } = {}) => Object.freeze({
  status: hidden ? 'hidden' : 'unavailable',
  reason,
  scope: 'securities',
  dayLedger: Object.freeze([]),
  statsOverrides: null,
});

export function buildAccountDailyPnlPresentation({ preview, currentGroup = 'all' } = {}) {
  if (currentGroup !== 'all') return unavailable('group_scope', { hidden: true });
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
    return unavailable('missing_preview');
  }
  if (preview.status !== 'ready') return unavailable(preview.reason || 'preview_unavailable');
  if (preview.scope !== 'whole_account' || preview.cash_ledger_complete !== true) {
    return unavailable('invalid_authority');
  }

  const publishedTotal = finite(preview.account_daily_pnl_twd);
  const rawTotal = finite(preview.account_daily_pnl_raw_twd);
  const baseValue = finite(preview.daily_pnl_base_value_twd);
  const returnPercent = preview.daily_pnl_roi_percent == null
    ? null
    : finite(preview.daily_pnl_roi_percent);
  const asOfDate = typeof preview.as_of_date === 'string' ? preview.as_of_date : '';
  const prevDate = typeof preview.prev_date === 'string' ? preview.prev_date : '';
  const ledger = Array.isArray(preview.day_ledger) ? preview.day_ledger : [];

  if (
    publishedTotal === null
    || rawTotal === null
    || baseValue === null
    || baseValue < 0
    || !asOfDate
    || !prevDate
    || ledger.length === 0
  ) {
    return unavailable('invalid_preview');
  }

  let ledgerTotal = 0;
  for (const row of ledger) {
    const value = finite(row?.total_pnl_twd);
    if (value === null) return unavailable('invalid_day_ledger');
    ledgerTotal += value;
  }
  if (Math.abs(ledgerTotal - rawTotal) > RECONCILIATION_TOLERANCE_TWD) {
    return unavailable('day_ledger_mismatch');
  }
  if (Math.abs(Math.round(rawTotal) - publishedTotal) > RECONCILIATION_TOLERANCE_TWD) {
    return unavailable('published_total_mismatch');
  }

  return Object.freeze({
    status: 'ready',
    reason: null,
    scope: 'account',
    dayLedger: Object.freeze(ledger.slice()),
    statsOverrides: Object.freeze({
      daily_pnl_twd: publishedTotal,
      daily_pnl_roi_percent: returnPercent,
      daily_pnl_base_value: baseValue,
      daily_pnl_asof_date: asOfDate,
      daily_pnl_prev_date: prevDate,
    }),
  });
}

export const __test = Object.freeze({ RECONCILIATION_TOLERANCE_TWD });
