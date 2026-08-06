const DEFAULT_LIMIT = 1_000;
const DEFAULT_MAX_PAGES = 100;
const DEFAULT_MAX_RECORDS = 100_000;

function requirePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function requirePlainObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function normalizeRecordId(record) {
  requirePlainObject(record, 'record');
  const id = typeof record.id === 'number' ? record.id : Number(record.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('record.id must be a positive integer');
  }
  return String(id);
}

export function buildRecordsPageEndpoint({ limit = DEFAULT_LIMIT, cursor = null } = {}) {
  requirePositiveInteger(limit, 'limit', DEFAULT_LIMIT);
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null && cursor !== undefined && cursor !== '') {
    if (typeof cursor !== 'string' || cursor.length > 2_048) {
      throw new Error('cursor must be a bounded string');
    }
    params.set('cursor', cursor);
  }
  return `/api/records?${params.toString()}`;
}

export async function fetchAllRecordPages(fetchPage, options = {}) {
  if (typeof fetchPage !== 'function') throw new TypeError('fetchPage must be a function');

  const limit = requirePositiveInteger(options.limit ?? DEFAULT_LIMIT, 'limit', DEFAULT_LIMIT);
  const maxPages = requirePositiveInteger(
    options.maxPages ?? DEFAULT_MAX_PAGES,
    'maxPages',
    10_000,
  );
  const maxRecords = requirePositiveInteger(
    options.maxRecords ?? DEFAULT_MAX_RECORDS,
    'maxRecords',
    10_000_000,
  );

  const records = [];
  const seenRecordIds = new Set();
  const seenCursors = new Set();
  let cursor = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const payload = await fetchPage({ limit, cursor, pageNumber });
    requirePlainObject(payload, 'records response');
    if (payload.success !== true) throw new Error('records response was not successful');
    if (!Array.isArray(payload.data)) throw new Error('records response data must be an array');

    for (const record of payload.data) {
      const id = normalizeRecordId(record);
      if (seenRecordIds.has(id)) throw new Error(`duplicate record id detected: ${id}`);
      seenRecordIds.add(id);
      records.push(record);
      if (records.length > maxRecords) {
        throw new Error(`record count exceeded ${maxRecords}`);
      }
    }

    // Compatibility with the pre-pagination response contract.
    if (payload.page === undefined || payload.page === null) return records;

    const page = requirePlainObject(payload.page, 'records page metadata');
    if (page.limit !== limit) throw new Error('records page limit does not match the request');
    if (!Number.isSafeInteger(page.count) || page.count !== payload.data.length) {
      throw new Error('records page count does not match the response data');
    }
    if (typeof page.has_more !== 'boolean') {
      throw new Error('records page has_more must be a boolean');
    }

    if (!page.has_more) {
      if (page.next_cursor !== null && page.next_cursor !== undefined && page.next_cursor !== '') {
        throw new Error('terminal records page must not include a next cursor');
      }
      return records;
    }

    if (
      typeof page.next_cursor !== 'string'
      || page.next_cursor.length < 1
      || page.next_cursor.length > 2_048
    ) {
      throw new Error('records page is missing a valid next cursor');
    }
    if (seenCursors.has(page.next_cursor)) {
      throw new Error('records cursor cycle detected');
    }
    seenCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }

  throw new Error(`records pagination exceeded ${maxPages} pages`);
}

export const RECORD_PAGE_DEFAULT_LIMIT = DEFAULT_LIMIT;
export const RECORD_PAGE_DEFAULT_MAX_PAGES = DEFAULT_MAX_PAGES;
export const RECORD_PAGE_DEFAULT_MAX_RECORDS = DEFAULT_MAX_RECORDS;
