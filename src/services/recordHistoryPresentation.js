const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeRecordDate = value => {
  const text = String(value || '').trim();
  return DATE_ONLY_RE.test(text) ? text : '';
};

export const getRecordTags = record => {
  const raw = String(record?.tag || '');
  const seen = new Set();
  const tags = [];
  for (const part of raw.split(/[,;]/)) {
    const tag = part.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
};

export const getHistoryDateRangeError = ({ dateFrom = '', dateTo = '' } = {}) => {
  const from = normalizeRecordDate(dateFrom);
  const to = normalizeRecordDate(dateTo);
  if (dateFrom && !from) return '開始日期格式無效';
  if (dateTo && !to) return '結束日期格式無效';
  if (from && to && from > to) return '開始日期不可晚於結束日期';
  return '';
};

export const recordMatchesHistoryFilters = (record, {
  query = '',
  type = 'ALL',
  dateFrom = '',
  dateTo = '',
  currentGroup = 'all',
} = {}) => {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  const normalizedType = String(type || 'ALL').toUpperCase();
  const recordDate = normalizeRecordDate(record?.txn_date);

  const matchesSearch = !normalizedQuery || [record?.symbol, record?.tag, record?.note]
    .some(value => String(value || '').toLocaleLowerCase().includes(normalizedQuery));
  if (!matchesSearch) return false;

  if (normalizedType !== 'ALL' && String(record?.txn_type || '').toUpperCase() !== normalizedType) {
    return false;
  }

  const from = normalizeRecordDate(dateFrom);
  const to = normalizeRecordDate(dateTo);
  if ((from || to) && !recordDate) return false;
  if (from && recordDate < from) return false;
  if (to && recordDate > to) return false;

  if (currentGroup !== 'all' && !getRecordTags(record).includes(currentGroup)) return false;

  return true;
};

export const hasLocalHistoryFilters = ({
  query = '',
  type = 'ALL',
  dateFrom = '',
  dateTo = '',
} = {}) => (
  String(query || '').trim() !== ''
  || String(type || 'ALL').toUpperCase() !== 'ALL'
  || String(dateFrom || '').trim() !== ''
  || String(dateTo || '').trim() !== ''
);
