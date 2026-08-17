import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildJournalBackupPackage } from '../src/services/journalBackupExport.js';
import {
  buildJournalRestorePreview,
  parseJournalRestoreBackupText,
  validateJournalRestoreBackup,
} from '../src/services/journalRestorePreview.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const record = (overrides = {}) => ({
  id: 1,
  txn_date: '2026-08-01',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 2,
  price: 100,
  fee: 1,
  tax: 0,
  tag: 'Stock',
  note: 'restore test',
  created_at: '2026-08-01 12:00:00',
  currency: 'USD',
  executed_at: '2026-08-01T20:00:00Z',
  execution_sequence: 'order-1:fill-1',
  event_source: 'IBKR',
  ...overrides,
});

const cashEvent = (overrides = {}) => ({
  id: 10,
  event_date: '2026-07-31',
  event_type: 'OPENING_BALANCE',
  amount: 500,
  currency: 'USD',
  note: 'baseline',
  event_source: 'MANUAL',
  created_at: '2026-08-17 01:00:00',
  updated_at: '2026-08-17 01:00:00',
  ...overrides,
});

const backup = ({ records = [record()], cashEvents = [cashEvent()], generatedAt = '2026-08-17T07:00:00Z' } = {}) => (
  buildJournalBackupPackage({ records, cashEvents, generatedAt })
);

test('restore backup parser accepts only the reviewed v1 authority/count contract', () => {
  const source = backup();
  const parsed = parseJournalRestoreBackupText(JSON.stringify(source));
  assert.equal(parsed.schema_version, 1);
  assert.deepEqual(parsed.counts, { records: 1, cash_events: 1 });

  assert.throws(() => parseJournalRestoreBackupText('{bad'), /not valid JSON/);
  assert.throws(() => validateJournalRestoreBackup({ ...source, future_restore_flag: true }), /unsupported fields/);
  assert.throws(() => validateJournalRestoreBackup({ ...source, schema_version: 99 }), /schema version 99 is unsupported/);
  assert.throws(() => validateJournalRestoreBackup({
    ...source,
    counts: { records: 99, cash_events: 1 },
  }), /counts do not match/);
  assert.throws(() => validateJournalRestoreBackup({
    ...source,
    authority: { ...source.authority, browser_local_state_included: true },
  }), /browser-local authority/);
});

test('empty destination produces create preview but preview service itself enables no writes', () => {
  const source = backup({
    records: [record(), record({ id: 2, execution_sequence: 'order-1:fill-2' })],
    cashEvents: [cashEvent()],
  });
  const current = backup({ records: [], cashEvents: [], generatedAt: '2026-08-17T07:01:00Z' });
  const preview = buildJournalRestorePreview({ backup: source, current });

  assert.equal(preview.status, 'empty_ready');
  assert.equal(preview.writes_allowed, false);
  assert.deepEqual(preview.planned_creates, { records: 2, cash_events: 1 });
  assert.deepEqual(preview.current_counts, { records: 0, cash_events: 0 });
});

test('exact portable multiset is already restored even when destination ids and timestamps differ', () => {
  const source = backup({
    records: [record(), record({ id: 2, execution_sequence: 'order-1:fill-2' })],
    cashEvents: [cashEvent()],
  });
  const current = backup({
    records: [
      record({ id: 900, created_at: '2026-08-18 00:00:00' }),
      record({ id: 901, created_at: '2026-08-18 00:00:01', execution_sequence: 'order-1:fill-2' }),
    ],
    cashEvents: [cashEvent({
      id: 902,
      created_at: '2026-08-18 00:00:02',
      updated_at: '2026-08-18 00:00:03',
    })],
    generatedAt: '2026-08-18T01:00:00Z',
  });
  const preview = buildJournalRestorePreview({ backup: source, current });

  assert.equal(preview.status, 'already_restored');
  assert.equal(preview.writes_allowed, false);
  assert.deepEqual(preview.planned_creates, { records: 0, cash_events: 0 });
});

test('cash event provenance is part of authoritative restore equality', () => {
  const source = backup();
  const changedSource = backup({
    records: [record({ id: 900, created_at: '2026-08-18 00:00:00' })],
    cashEvents: [cashEvent({
      id: 901,
      event_source: 'IMPORT',
      created_at: '2026-08-18 00:00:01',
      updated_at: '2026-08-18 00:00:02',
    })],
    generatedAt: '2026-08-18T01:00:00Z',
  });

  const preview = buildJournalRestorePreview({ backup: source, current: changedSource });
  assert.equal(preview.status, 'conflict_nonempty');
});

test('multiset comparison preserves legitimate duplicate multiplicity instead of field-level deduplication', () => {
  const duplicated = record({ note: 'two legitimate identical fills', execution_sequence: null });
  const source = backup({
    records: [duplicated, { ...duplicated, id: 2, created_at: '2026-08-01 12:00:01' }],
    cashEvents: [],
  });
  const onlyOne = backup({
    records: [{ ...duplicated, id: 500, created_at: '2026-08-18 00:00:00' }],
    cashEvents: [],
    generatedAt: '2026-08-18T01:00:00Z',
  });

  const preview = buildJournalRestorePreview({ backup: source, current: onlyOne });
  assert.equal(preview.status, 'conflict_nonempty');
  assert.equal(preview.writes_allowed, false);
  assert.deepEqual(preview.planned_creates, { records: 0, cash_events: 0 });
});

test('any non-empty partial difference blocks guessed merge or overwrite', () => {
  const source = backup();
  const changed = backup({
    records: [record({ price: 101, id: 200 })],
    cashEvents: [cashEvent({ id: 201 })],
    generatedAt: '2026-08-18T01:00:00Z',
  });
  const preview = buildJournalRestorePreview({ backup: source, current: changed });

  assert.equal(preview.status, 'conflict_nonempty');
  assert.equal(preview.writes_allowed, false);
  assert.deepEqual(preview.planned_creates, { records: 0, cash_events: 0 });
});

test('preview remains a zero-write authority check while execution is isolated behind a separate service', () => {
  const backupComponent = fs.readFileSync(path.join(ROOT, 'src/components/JournalBackupButton.vue'), 'utf8');
  const restoreComponent = fs.readFileSync(path.join(ROOT, 'src/components/JournalRestoreButton.vue'), 'utf8');
  const recordList = fs.readFileSync(path.join(ROOT, 'src/components/RecordList.vue'), 'utf8');
  const previewService = fs.readFileSync(path.join(ROOT, 'src/services/journalRestorePreview.js'), 'utf8');
  const executionService = fs.readFileSync(path.join(ROOT, 'src/services/journalRestoreExecution.js'), 'utf8');

  assert.match(recordList, /<IbkrTradeImport \/>\s*<JournalBackupButton \/>/);
  assert.match(backupComponent, /<JournalRestoreButton \/>/);
  assert.match(backupComponent, /交易資料備份與還原/);
  assert.match(restoreComponent, /安全還原/);
  assert.match(restoreComponent, /確認建立紀錄/);
  assert.match(previewService, /writes_allowed:\s*false/);
  assert.doesNotMatch(previewService, /method:\s*['"](?:POST|PUT|DELETE)['"]/);
  assert.match(executionService, /method:\s*'POST'/);
  assert.match(executionService, /\/api\/journal-restore/);
});
