import {
  buildConfirmedDividendKeySet,
  getPendingDividendEventKey,
} from './dividendConfirmation.js';
import { sortDividendRowsRecentFirst } from './dividendWorkflowPresentation.js';

export const buildDividendAttention = ({
  pendingDividends = [],
  records = [],
} = {}) => {
  const confirmedKeys = buildConfirmedDividendKeySet(records);
  const candidates = sortDividendRowsRecentFirst(
    Array.isArray(pendingDividends)
      ? pendingDividends.filter(dividend => {
        const key = getPendingDividendEventKey(dividend);
        return Boolean(key && !confirmedKeys.has(key));
      })
      : [],
  );

  return Object.freeze({
    status: 'ready',
    count: candidates.length,
    next: candidates[0] || null,
    candidates: Object.freeze(candidates),
  });
};
