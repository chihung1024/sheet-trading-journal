import { isTwrPointReliable, relativeTwrValue } from './twrState.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_NAME_MAX_LENGTH = 120;

const unavailableMetric = (status = 'unavailable', reason = null) => Object.freeze({
  status,
  reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 160) : null,
  value: null,
  legacy: false,
});

const finiteMetric = (value) => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const normalizeGroupName = (value) => {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > GROUP_NAME_MAX_LENGTH || name !== value) return null;
  return name;
};

const buildPerformanceMetric = (summary, key, statusKey, reasonKey) => {
  const value = finiteMetric(summary?.[key]);
  const status = summary?.[statusKey];

  if (status === undefined || status === null || status === '') {
    return value === null
      ? unavailableMetric('unavailable')
      : Object.freeze({ status: 'ok', reason: null, value, legacy: true });
  }

  if (status !== 'ok') return unavailableMetric(String(status), summary?.[reasonKey]);
  if (value === null) return unavailableMetric('invalid_value', summary?.[reasonKey]);
  return Object.freeze({ status: 'ok', reason: null, value, legacy: false });
};

const historyRange = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return Object.freeze({ startDate: null, endDate: null });
  }

  const dates = history
    .map(row => (row && typeof row === 'object' && !Array.isArray(row) ? row.date : null))
    .filter(date => typeof date === 'string' && ISO_DATE_RE.test(date));

  if (dates.length === 0) return Object.freeze({ startDate: null, endDate: null });
  return Object.freeze({
    startDate: dates.reduce((min, date) => (date < min ? date : min), dates[0]),
    endDate: dates.reduce((max, date) => (date > max ? date : max), dates[0]),
  });
};

const unavailableCommonPeriod = (reason, status = 'unavailable') => Object.freeze({
  status,
  reason,
  startDate: null,
  endDate: null,
  metrics: Object.freeze(Object.create(null)),
});

const reliableHistoryByDate = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return Object.freeze({ status: 'invalid', reason: 'missing_history', rows: null });
  }

  const rows = new Map();
  for (const row of history) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return Object.freeze({ status: 'invalid', reason: 'invalid_history_row', rows: null });
    }

    const date = row.date;
    if (typeof date !== 'string' || !ISO_DATE_RE.test(date)) {
      return Object.freeze({ status: 'invalid', reason: 'invalid_history_date', rows: null });
    }
    if (rows.has(date)) {
      return Object.freeze({ status: 'invalid', reason: 'duplicate_history_date', rows: null });
    }

    // Track every date first so duplicate-date evidence cannot be hidden merely
    // because one copy is unreliable. Only reliable rows participate in comparison.
    rows.set(date, isTwrPointReliable(row) ? row : null);
  }

  return Object.freeze({ status: 'ready', reason: null, rows });
};

const buildCommonPeriodTwr = (groupEntries) => {
  if (!Array.isArray(groupEntries) || groupEntries.length < 2) {
    return unavailableCommonPeriod('insufficient_groups', 'not_applicable');
  }

  const histories = [];
  for (const [name, group] of groupEntries) {
    const reliable = reliableHistoryByDate(group?.history);
    if (reliable.status !== 'ready') {
      return unavailableCommonPeriod(reliable.reason || 'invalid_history');
    }
    histories.push([name, reliable.rows]);
  }

  const firstRows = histories[0][1];
  const commonDates = [...firstRows.entries()]
    .filter(([, row]) => row !== null)
    .map(([date]) => date)
    .filter(date => histories.every(([, rows]) => rows.get(date) != null))
    .sort();

  if (commonDates.length < 2) {
    return unavailableCommonPeriod('insufficient_common_reliable_dates');
  }

  const startDate = commonDates[0];
  const endDate = commonDates[commonDates.length - 1];
  if (startDate >= endDate) {
    return unavailableCommonPeriod('invalid_common_period');
  }

  // Group names are user-defined Tag values. A null-prototype dictionary keeps
  // keys such as "__proto__" and "constructor" exact instead of colliding with
  // JavaScript object-prototype properties.
  const metrics = Object.create(null);
  for (const [name, rows] of histories) {
    const relative = relativeTwrValue(rows.get(endDate), rows.get(startDate));
    if (typeof relative !== 'number' || !Number.isFinite(relative)) {
      return unavailableCommonPeriod('invalid_relative_twr');
    }
    metrics[name] = Object.freeze({
      status: 'ok',
      reason: null,
      value: relative,
      legacy: false,
    });
  }

  return Object.freeze({
    status: 'ready',
    reason: null,
    startDate,
    endDate,
    metrics: Object.freeze(metrics),
  });
};

const buildGroupRow = (name, group, commonPeriod) => {
  const summary = group && typeof group === 'object' && !Array.isArray(group)
    ? group.summary
    : null;

  return Object.freeze({
    name,
    historyRange: historyRange(group?.history),
    totalValueTwd: finiteMetric(summary?.total_value),
    investedCapitalTwd: finiteMetric(summary?.invested_capital),
    totalPnlTwd: finiteMetric(summary?.total_pnl),
    twr: buildPerformanceMetric(summary, 'twr', 'twr_status', 'twr_reason'),
    xirr: buildPerformanceMetric(summary, 'xirr', 'xirr_status', 'xirr_reason'),
    commonPeriodTwr: commonPeriod?.status === 'ready' && commonPeriod.metrics?.[name]
      ? commonPeriod.metrics[name]
      : unavailableMetric('unavailable', commonPeriod?.reason),
    holdingsCount: Array.isArray(group?.holdings) ? group.holdings.length : null,
  });
};

export function buildStrategyGroupOverview(rawData) {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return Object.freeze({
      status: 'unavailable',
      updatedAt: null,
      commonPeriodTwr: unavailableCommonPeriod('missing_snapshot'),
      groups: Object.freeze([]),
    });
  }

  const sourceGroups = rawData.groups;
  if (!sourceGroups || typeof sourceGroups !== 'object' || Array.isArray(sourceGroups)) {
    return Object.freeze({
      status: 'unavailable',
      updatedAt: null,
      commonPeriodTwr: unavailableCommonPeriod('missing_groups'),
      groups: Object.freeze([]),
    });
  }

  const groupEntries = Object.entries(sourceGroups)
    .map(([rawName, group]) => [normalizeGroupName(rawName), group])
    .filter(([name]) => name && name !== 'all')
    .sort(([left], [right]) => left.localeCompare(right));

  const commonPeriod = buildCommonPeriodTwr(groupEntries);
  const groups = groupEntries.map(([name, group]) => buildGroupRow(name, group, commonPeriod));

  const updatedAt = typeof rawData.updated_at === 'string' && rawData.updated_at.trim()
    ? rawData.updated_at.trim().slice(0, 64)
    : null;

  return Object.freeze({
    status: groups.length > 0 ? 'ready' : 'empty',
    updatedAt,
    commonPeriodTwr: Object.freeze({
      status: commonPeriod.status,
      reason: commonPeriod.reason,
      startDate: commonPeriod.startDate,
      endDate: commonPeriod.endDate,
    }),
    groups: Object.freeze(groups),
  });
}

export const __test = Object.freeze({
  GROUP_NAME_MAX_LENGTH,
  ISO_DATE_RE,
});