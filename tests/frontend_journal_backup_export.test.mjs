import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  JOURNAL_BACKUP_FORMAT,
  JOURNAL_BACKUP_SCHEMA_VERSION,
  buildJournalBackupFilename,
  buildJournalBackupPackage,
  createJournalBackup,
  downloadJournalBackup,
} from '../src/services/journalBackupExport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const record = (overrides = {}) => ({
  id: 1,
  user_id: 'tenant@example.test',
  txn_date: '2026-08-01',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 2,
  price: 100,
  fee: 1,
  tax: 0,
  tag: 'Stock',
  note: 'source=IBKR; order_id=abc; user_journal=keep-this-raw-envelope',
  created_at: '2026-08-01 12:00:00',
  currency: 'USD',
  executed_at: '2026-08-01T20:00:00Z',
  execution_sequence: '1',
  event_source: 'IBKR',
  create_idempotency_hash: 'secret-internal-hash',
  ...overrides,
});

const cashEvent = (overrides = {}) => ({
  id: 10,
  user_id: 'tenant@example.test',
  event_date: '2026-07-31',
  event_type: 'OPENING_BALANCE',
  amount: 500,
  currency: 'USD',
  note: 'authoritative opening',
  event_source: 'USER',
  create_idempotency_hash: 'cash-secret-hash',
  create_payload_hash: 'cash-payload-hash',
  created_at: '2026-08-17 01:00:00',
  updated_at: '2026-08-17 01:00:00',
  ...overrides,
});

const response = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const pagePayload = ({ rows, hasMore = false, nextCursor = null }) => ({
  success: true,
  data: rows,
  page: {
    limit: 1000,
    count: rows.length,
    has_more: hasMore,
    next_cursor: nextCursor,
  },
});

const cashPayload = (rows) => ({ success: true, cash_events: rows });

test('backup reads every authoritative record page and preserves the raw durable note envelope', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), authorization: options.headers.Authorization });
    if (calls.length === 1) {
      return response(pagePayload({ rows: [record()], hasMore: true, nextCursor: 'cursor-2' }));
    }
    if (calls.length === 2) {
      return response(pagePayload({ rows: [record({ id: 2, symbol: 'VOD.L', currency: 'GBp' })] }));
    }
    return response(cashPayload([cashEvent()]));
  };

  const backup = await createJournalBackup({
    apiBaseUrl: 'https://api.example.test',
    getToken: () => 'token-a',
    refreshToken: async () => assert.fail('refresh should not run'),
    fetchImpl,
    now: () => new Date('2026-08-17T06:40:00Z'),
  });

  assert.equal(backup.format, JOURNAL_BACKUP_FORMAT);
  assert.equal(backup.schema_version, JOURNAL_BACKUP_SCHEMA_VERSION);
  assert.deepEqual(backup.counts, { records: 2, cash_events: 1 });
  assert.equal(backup.records[0].note, record().note);
  assert.equal(backup.records[1].currency, 'GBp');
  assert.equal(backup.records[0].user_id, undefined);
  assert.equal(backup.records[0].create_idempotency_hash, undefined);
  assert.equal(backup.cash_events[0].user_id, undefined);
  assert.equal(backup.cash_events[0].create_payload_hash, undefined);
  assert.equal(backup.authority.derived_portfolio_snapshot_included, false);
  assert.equal(backup.authority.browser_local_state_included, false);
  assert.match(calls[0].url, /\/api\/records\?limit=1000$/);
  assert.match(calls[1].url, /cursor=cursor-2/);
  assert.match(calls[2].url, /\/api\/cash-events$/);
});

test('backup refreshes a 401 once and retries using the renewed bearer token', async () => {
  let token = 'token-a';
  let refreshCount = 0;
  const authorizations = [];
  let call = 0;
  const fetchImpl = async (_url, options) => {
    call += 1;
    authorizations.push(options.headers.Authorization);
    if (call === 1) return response({ success: false, error: 'Unauthorized' }, 401);
    if (call === 2) return response(pagePayload({ rows: [record()] }));
    return response(cashPayload([cashEvent()]));
  };

  const backup = await createJournalBackup({
    apiBaseUrl: 'https://api.example.test',
    getToken: () => token,
    refreshToken: async () => {
      refreshCount += 1;
      token = 'token-b';
    },
    fetchImpl,
    now: () => new Date('2026-08-17T06:40:00Z'),
  });

  assert.equal(backup.counts.records, 1);
  assert.equal(refreshCount, 1);
  assert.deepEqual(authorizations, ['Bearer token-a', 'Bearer token-b', 'Bearer token-b']);
});

test('backup fails closed on an unknown server record field instead of silently omitting future durable data', async () => {
  const fetchImpl = async () => response(pagePayload({ rows: [record({ future_financial_field: 'new' })] }));
  await assert.rejects(
    createJournalBackup({
      apiBaseUrl: 'https://api.example.test',
      getToken: () => 'token-a',
      refreshToken: async () => {},
      fetchImpl,
    }),
    /unreviewed server fields: future_financial_field/,
  );
});

test('backup fails closed on a record pagination cursor cycle', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(pagePayload({
      rows: [record({ id: calls })],
      hasMore: true,
      nextCursor: 'same-cursor',
    }));
  };

  await assert.rejects(
    createJournalBackup({
      apiBaseUrl: 'https://api.example.test',
      getToken: () => 'token-a',
      refreshToken: async () => {},
      fetchImpl,
    }),
    /cursor cycle detected/,
  );
});

test('backup contract is deterministic, tenant-neutral, and excludes browser-derived state', () => {
  const backup = buildJournalBackupPackage({
    records: [record()],
    cashEvents: [cashEvent()],
    generatedAt: new Date('2026-08-17T06:40:00Z'),
  });

  assert.equal(backup.generated_at, '2026-08-17T06:40:00.000Z');
  assert.equal(buildJournalBackupFilename(backup.generated_at), 'sheet-trading-journal-backup-2026-08-17T06-40-00-000Z.json');
  assert.equal(backup.authority.derived_portfolio_snapshot_included, false);
  assert.equal(backup.authority.browser_local_state_included, false);
  assert.equal(Object.hasOwn(backup, 'portfolio_snapshot'), false);
  const serialized = JSON.stringify(backup);
  assert.doesNotMatch(serialized, /tenant@example\.test/);
  assert.doesNotMatch(serialized, /secret-internal-hash|cash-secret-hash|cash-payload-hash/);
  assert.doesNotMatch(serialized, /"access_token"|"refresh_token"|"portfolio_snapshot"|"localStorage"/);
});

test('browser download is created only from a validated backup contract and always revokes the object URL', () => {
  const backup = buildJournalBackupPackage({
    records: [record()],
    cashEvents: [cashEvent()],
    generatedAt: new Date('2026-08-17T06:40:00Z'),
  });
  const events = [];
  const anchor = {
    style: {},
    click: () => events.push('click'),
    remove: () => events.push('remove'),
  };
  const documentImpl = {
    createElement: tag => {
      assert.equal(tag, 'a');
      return anchor;
    },
    body: { appendChild: item => {
      assert.equal(item, anchor);
      events.push('append');
    } },
  };
  const urlImpl = {
    createObjectURL: () => {
      events.push('create-url');
      return 'blob:backup';
    },
    revokeObjectURL: value => events.push(`revoke:${value}`),
  };
  class FakeBlob {
    constructor(parts, options) {
      assert.match(parts[0], /sheet-trading-journal-backup/);
      assert.equal(options.type, 'application/json;charset=utf-8');
    }
  }

  const filename = downloadJournalBackup(backup, { documentImpl, urlImpl, BlobImpl: FakeBlob });
  assert.equal(filename, 'sheet-trading-journal-backup-2026-08-17T06-40-00-000Z.json');
  assert.deepEqual(events, ['create-url', 'append', 'click', 'remove', 'revoke:blob:backup']);
});

test('overview backup UX uses fresh backup service rather than the projected portfolio records store', () => {
  const component = fs.readFileSync(path.join(ROOT, 'src/components/JournalBackupButton.vue'), 'utf8');
  const overview = fs.readFileSync(path.join(ROOT, 'src/components/OverviewPage.vue'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'src/services/journalBackupExport.js'), 'utf8');

  assert.match(overview, /<JournalBackupButton v-if="!store\.loading" \/>/);
  assert.match(component, /createJournalBackup\(/);
  assert.match(component, /authStore\.refreshToken\(\)/);
  assert.match(component, /不包含登入憑證、本機快取或衍生投資組合快照/);
  assert.doesNotMatch(component, /portfolioStore|store\.records|localStorage/);
  assert.match(service, /buildRecordsPageEndpoint/);
  assert.doesNotMatch(service, /fetchAllRecordPages/);
  assert.doesNotMatch(service, /extractIbkrUserJournalNote/);
  assert.doesNotMatch(service, /POST|PUT|DELETE|\/api\/portfolio/);
});
