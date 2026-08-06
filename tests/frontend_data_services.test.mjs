import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRecordsPageEndpoint,
  fetchAllRecordPages,
} from '../src/services/recordPagination.js';
import {
  clearLegacyRecordCache,
  clearSensitiveProjectStorage,
  SENSITIVE_PROJECT_STORAGE_KEYS,
} from '../src/services/projectStorage.js';

function page(data, { limit = 1_000, hasMore = false, nextCursor = null } = {}) {
  return {
    success: true,
    data,
    page: {
      limit,
      count: data.length,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  };
}

function record(id) {
  return { id, symbol: `T${id}` };
}

function storageWith(entries) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

test('records endpoint encodes the signed cursor and bounded limit', () => {
  assert.equal(buildRecordsPageEndpoint(), '/api/records?limit=1000');
  assert.equal(
    buildRecordsPageEndpoint({ limit: 250, cursor: 'abc+/_=' }),
    '/api/records?limit=250&cursor=abc%2B%2F_%3D',
  );
  assert.throws(() => buildRecordsPageEndpoint({ limit: 1_001 }), /limit/);
});

test('legacy unpaginated records response remains compatible below the limit', async () => {
  const result = await fetchAllRecordPages(async () => ({
    success: true,
    data: [record(1), record(2)],
  }));
  assert.deepEqual(result.map((item) => item.id), [1, 2]);
});

test('legacy response at the page limit fails because completeness is unknowable', async () => {
  const legacyLimitPage = Array.from({ length: 1_000 }, (_, index) => record(index + 1));
  await assert.rejects(
    fetchAllRecordPages(async () => ({ success: true, data: legacyLimitPage })),
    /without pagination metadata/,
  );
});

test('browser retrieves every records page beyond one thousand rows', async () => {
  const first = Array.from({ length: 1_000 }, (_, index) => record(index + 1));
  const second = [record(1_001), record(1_002)];
  const calls = [];

  const result = await fetchAllRecordPages(async ({ cursor }) => {
    calls.push(cursor);
    return cursor === null
      ? page(first, { hasMore: true, nextCursor: 'cursor-2' })
      : page(second);
  });

  assert.equal(result.length, 1_002);
  assert.deepEqual(calls, [null, 'cursor-2']);
  assert.equal(result.at(-1).id, 1_002);
});

test('records pagination fails closed on malformed metadata', async () => {
  await assert.rejects(
    fetchAllRecordPages(async () => ({ success: true, data: [], page: { has_more: false } })),
    /limit/,
  );
  await assert.rejects(
    fetchAllRecordPages(async () => ({
      success: true,
      data: [record(1)],
      page: { limit: 1_000, count: 0, has_more: false, next_cursor: null },
    })),
    /count/,
  );
  await assert.rejects(
    fetchAllRecordPages(async () => ({ success: false, data: [] })),
    /not successful/,
  );
});

test('records pagination rejects missing and repeated cursors', async () => {
  await assert.rejects(
    fetchAllRecordPages(async () => page([record(1)], { hasMore: true })),
    /next cursor/,
  );

  let call = 0;
  await assert.rejects(
    fetchAllRecordPages(async () => {
      call += 1;
      return call === 1
        ? page([record(1)], { hasMore: true, nextCursor: 'same' })
        : page([record(2)], { hasMore: true, nextCursor: 'same' });
    }),
    /cursor cycle/,
  );
});

test('records pagination rejects duplicate record IDs', async () => {
  let call = 0;
  await assert.rejects(
    fetchAllRecordPages(async () => {
      call += 1;
      return call === 1
        ? page([record(1)], { hasMore: true, nextCursor: 'next' })
        : page([record(1)]);
    }),
    /duplicate record id/,
  );
});

test('records pagination enforces page and record bounds', async () => {
  await assert.rejects(
    fetchAllRecordPages(
      async () => page([record(1)], { hasMore: true, nextCursor: 'next' }),
      { maxPages: 1 },
    ),
    /exceeded 1 pages/,
  );

  await assert.rejects(
    fetchAllRecordPages(async () => page([record(1), record(2)]), { maxRecords: 1 }),
    /record count exceeded 1/,
  );
});

test('scoped logout cleanup preserves UI preferences and unrelated origin data', () => {
  const sensitiveEntries = Object.fromEntries(
    SENSITIVE_PROJECT_STORAGE_KEYS.map((key) => [key, `value:${key}`]),
  );
  const storage = storageWith({
    ...sensitiveEntries,
    theme: 'dark',
    'sheet_trading_journal.activeView': 'records',
    unrelated_application_key: 'preserve-me',
  });

  const removed = clearSensitiveProjectStorage(storage);
  assert.deepEqual(removed, [...SENSITIVE_PROJECT_STORAGE_KEYS]);
  assert.deepEqual(storage.snapshot(), {
    theme: 'dark',
    'sheet_trading_journal.activeView': 'records',
    unrelated_application_key: 'preserve-me',
  });
});

test('legacy transaction cache cleanup removes only cached_records', () => {
  const storage = storageWith({ cached_records: '[{"id":1}]', theme: 'light' });
  clearLegacyRecordCache(storage);
  assert.deepEqual(storage.snapshot(), { theme: 'light' });
});
