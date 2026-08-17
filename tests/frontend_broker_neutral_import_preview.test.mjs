import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  BROKER_NEUTRAL_IMPORT_PREVIEW_VERSION,
  CANONICAL_TRADE_CSV_FORMAT,
  MAX_CANONICAL_CSV_BYTES,
  BrokerNeutralImportPreviewError,
  buildCanonicalTradeCsvPreview,
} from '../src/services/brokerNeutralImportPreview.js';

const serviceSource = fs.readFileSync(
  new URL('../src/services/brokerNeutralImportPreview.js', import.meta.url),
  'utf8',
);
const componentSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralImportPreview.vue', import.meta.url),
  'utf8',
);
const journalActionsSource = fs.readFileSync(
  new URL('../src/components/JournalBackupButton.vue', import.meta.url),
  'utf8',
);
const recordListSource = fs.readFileSync(
  new URL('../src/components/RecordList.vue', import.meta.url),
  'utf8',
);

const headers = 'txn_date,symbol,txn_type,qty,price,currency,fee,tax,tag,note,executed_at,execution_sequence';

test('canonical v1 preview produces generic durable business fields without writes', () => {
  const csv = [
    headers,
    '2026-08-17,NVDA,BUY,2.5,182.25,USD,-0.25,0,Core,"manual, note",2026-08-17T09:30:00-04:00,source-1',
  ].join('\n');

  const preview = buildCanonicalTradeCsvPreview(csv, { fileSizeBytes: Buffer.byteLength(csv) });

  assert.equal(preview.preview_version, BROKER_NEUTRAL_IMPORT_PREVIEW_VERSION);
  assert.equal(preview.format, CANONICAL_TRADE_CSV_FORMAT);
  assert.equal(preview.writes_allowed, false);
  assert.equal(preview.status, 'ready');
  assert.deepEqual(preview.counts, {
    rows: 1,
    ready: 1,
    blocked: 0,
    warnings: 0,
    duplicate_groups: 0,
    duplicate_rows: 0,
  });
  assert.deepEqual(preview.rows[0].payload, {
    txn_date: '2026-08-17',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 2.5,
    price: 182.25,
    fee: -0.25,
    tax: 0,
    tag: 'Core',
    note: 'manual, note',
    currency: 'USD',
    executed_at: '2026-08-17T09:30:00-04:00',
    execution_sequence: 'source-1',
  });
  assert.equal('event_source' in preview.rows[0].payload, false);
});

test('unknown, missing and duplicate headers fail closed instead of being guessed or ignored', () => {
  const unknown = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price,currency,commission_guess',
    '2026-08-17,NVDA,BUY,1,100,USD,2',
  ].join('\n'));
  assert.equal(unknown.status, 'blocked');
  assert.equal(unknown.counts.ready, 0);
  assert.deepEqual(unknown.unsupported_headers, ['commission_guess']);
  assert.ok(unknown.file_issues.some((issue) => issue.code === 'UNSUPPORTED_HEADERS'));

  const missing = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price',
    '2026-08-17,NVDA,BUY,1,100',
  ].join('\n'));
  assert.equal(missing.status, 'blocked');
  assert.deepEqual(missing.missing_headers, ['currency']);

  const duplicate = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price,currency,currency',
    '2026-08-17,NVDA,BUY,1,100,USD,USD',
  ].join('\n'));
  assert.equal(duplicate.status, 'blocked');
  assert.deepEqual(duplicate.duplicate_headers, ['currency']);
});

test('canonical rows reject ambiguous dates, currencies, types, quantities and formatted numerics', () => {
  const preview = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price,currency,fee',
    '08/17/2026,nvda,DIV,-1,"1,000",usd,"$2"',
  ].join('\n'));

  assert.equal(preview.status, 'blocked');
  assert.equal(preview.counts.blocked, 1);
  const codes = new Set(preview.rows[0].issues.map((issue) => issue.code));
  assert.ok(codes.has('INVALID_DATE'));
  assert.ok(codes.has('INVALID_SYMBOL'));
  assert.ok(codes.has('UNSUPPORTED_TXN_TYPE'));
  assert.ok(codes.has('NON_POSITIVE_NUMBER'));
  assert.ok(codes.has('INVALID_NUMBER'));
  assert.ok(codes.has('INVALID_CURRENCY'));
});

test('executed_at requires an explicit offset and never rewrites a differing txn_date', () => {
  const withoutOffset = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price,currency,executed_at',
    '2026-08-17,NVDA,BUY,1,100,USD,2026-08-17T09:30:00',
  ].join('\n'));
  assert.equal(withoutOffset.status, 'blocked');
  assert.ok(withoutOffset.rows[0].issues.some((issue) => issue.code === 'INVALID_EXECUTED_AT'));

  const differingDate = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price,currency,executed_at',
    '2026-08-17,NVDA,BUY,1,100,USD,2026-08-18T00:30:00+08:00',
  ].join('\n'));
  assert.equal(differingDate.status, 'ready');
  assert.equal(differingDate.rows[0].payload.txn_date, '2026-08-17');
  assert.equal(differingDate.rows[0].payload.executed_at, '2026-08-18T00:30:00+08:00');
  assert.ok(differingDate.rows[0].warnings.some((issue) => issue.code === 'EXECUTED_DATE_DIFFERS'));
});

test('legitimate identical source rows preserve multiplicity and are never content-deduplicated', () => {
  const row = '2026-08-17,NVDA,BUY,1,100,USD';
  const preview = buildCanonicalTradeCsvPreview([
    'txn_date,symbol,txn_type,qty,price,currency',
    row,
    row,
  ].join('\n'));

  assert.equal(preview.status, 'ready');
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.counts.ready, 2);
  assert.equal(preview.counts.duplicate_groups, 1);
  assert.equal(preview.counts.duplicate_rows, 2);
  assert.ok(preview.rows.every((item) => item.warnings.some(
    (issue) => issue.code === 'DUPLICATE_PORTABLE_FIELDS_PRESERVED',
  )));
});

test('quoted commas, escaped quotes and multiline notes stay one source row', () => {
  const csv = [
    'txn_date,symbol,txn_type,qty,price,currency,note',
    '2026-08-17,NVDA,SELL,1,100,USD,"first line, with comma',
    'second line says ""done"""',
  ].join('\n');
  const preview = buildCanonicalTradeCsvPreview(csv);

  assert.equal(preview.status, 'ready');
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].payload.note, 'first line, with comma\nsecond line says "done"');
});

test('malformed CSV, file-size evidence and row caps fail closed', () => {
  assert.throws(
    () => buildCanonicalTradeCsvPreview('txn_date,symbol\n"2026-08-17,NVDA'),
    (error) => error instanceof BrokerNeutralImportPreviewError && error.code === 'MALFORMED_CSV',
  );
  assert.throws(
    () => buildCanonicalTradeCsvPreview('txn_date', { fileSizeBytes: MAX_CANONICAL_CSV_BYTES + 1 }),
    (error) => error instanceof BrokerNeutralImportPreviewError && error.code === 'FILE_TOO_LARGE',
  );

  const manyRows = [
    'txn_date,symbol,txn_type,qty,price,currency',
    ...Array.from({ length: 10_001 }, () => '2026-08-17,NVDA,BUY,1,100,USD'),
  ].join('\n');
  assert.throws(
    () => buildCanonicalTradeCsvPreview(manyRows),
    (error) => error instanceof BrokerNeutralImportPreviewError && error.code === 'TOO_MANY_ROWS',
  );
});

test('preview implementation is structurally zero-write and sits beside existing transaction data actions', () => {
  assert.doesNotMatch(serviceSource, /\bfetch\s*\(/);
  assert.doesNotMatch(serviceSource, /\/api\//);
  assert.doesNotMatch(serviceSource, /\b(?:POST|PUT|PATCH|DELETE)\b/);
  assert.doesNotMatch(componentSource, /createRecordFromIntent|createIbkrRecord|authStore|CONFIG\.API_BASE_URL/);
  assert.match(componentSource, /writes_allowed = false/);
  assert.match(componentSource, /零寫入預覽/);
  assert.doesNotMatch(componentSource, /確認匯入|執行匯入|開始匯入/);

  assert.match(recordListSource, /<IbkrTradeImport \/>[\s\S]*<JournalBackupButton \/>/);
  assert.match(journalActionsSource, /<BrokerNeutralImportPreview \/>[\s\S]*class="backup-button"[\s\S]*<JournalRestoreButton \/>/);
});
