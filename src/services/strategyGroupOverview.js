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

const buildGroupRow = (name, group) => {
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
    holdingsCount: Array.isArray(group?.holdings) ? group.holdings.length : null,
  });
};

export function buildStrategyGroupOverview(rawData) {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return Object.freeze({ status: 'unavailable', updatedAt: null, groups: Object.freeze([]) });
  }

  const sourceGroups = rawData.groups;
  if (!sourceGroups || typeof sourceGroups !== 'object' || Array.isArray(sourceGroups)) {
    return Object.freeze({ status: 'unavailable', updatedAt: null, groups: Object.freeze([]) });
  }

  const groups = Object.entries(sourceGroups)
    .map(([rawName, group]) => [normalizeGroupName(rawName), group])
    .filter(([name]) => name && name !== 'all')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, group]) => buildGroupRow(name, group));

  const updatedAt = typeof rawData.updated_at === 'string' && rawData.updated_at.trim()
    ? rawData.updated_at.trim().slice(0, 64)
    : null;

  return Object.freeze({
    status: groups.length > 0 ? 'ready' : 'empty',
    updatedAt,
    groups: Object.freeze(groups),
  });
}

export const __test = Object.freeze({
  GROUP_NAME_MAX_LENGTH,
  ISO_DATE_RE,
});
