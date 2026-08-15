import { getPendingDividendEventKey } from './dividendConfirmation.js';

const recentFirst = (left, right) => {
  const leftDate = String(left?.ex_date || '');
  const rightDate = String(right?.ex_date || '');
  const dateCompare = rightDate.localeCompare(leftDate);
  if (dateCompare !== 0) return dateCompare;

  const leftSymbol = String(left?.symbol || '').trim().toUpperCase();
  const rightSymbol = String(right?.symbol || '').trim().toUpperCase();
  return leftSymbol.localeCompare(rightSymbol);
};

export const sortDividendRowsRecentFirst = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return [...rows].sort(recentFirst);
};

export const buildDividendWorkflowSections = (
  rows = [],
  confirmedKeys = new Set(),
  awaitingReadbackKeys = new Set(),
) => {
  if (!Array.isArray(rows)) {
    return Object.freeze({
      pending: [],
      awaiting: [],
      active: [],
      confirmed: [],
    });
  }

  const pending = [];
  const awaiting = [];
  const confirmed = [];

  for (const row of rows) {
    const key = getPendingDividendEventKey(row);
    if (key && confirmedKeys instanceof Set && confirmedKeys.has(key)) {
      confirmed.push(row);
      continue;
    }
    if (key && awaitingReadbackKeys instanceof Set && awaitingReadbackKeys.has(key)) {
      awaiting.push(row);
      continue;
    }
    pending.push(row);
  }

  const pendingRecentFirst = sortDividendRowsRecentFirst(pending);
  const awaitingRecentFirst = sortDividendRowsRecentFirst(awaiting);
  const confirmedRecentFirst = sortDividendRowsRecentFirst(confirmed);

  return Object.freeze({
    pending: pendingRecentFirst,
    awaiting: awaitingRecentFirst,
    active: sortDividendRowsRecentFirst([...pendingRecentFirst, ...awaitingRecentFirst]),
    confirmed: confirmedRecentFirst,
  });
};
