import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  BrokerNeutralColumnMappingError,
  MAPPING_SOURCE_MODE,
  buildMappedCanonicalTradePreview,
  parseBrokerSourceCsv,
} from '../src/services/brokerNeutralColumnMapping.js';

const serviceSource = fs.readFileSync(
  new URL('../src/services/brokerNeutralColumnMapping.js', import.meta.url),
  'utf8',
);
const mappingComponentSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralColumnMapping.vue', import.meta.url),
  'utf8',
);
const toolsComponentSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralCsvTemplateButton.vue', import.meta.url),
  'utf8',
);
const journalActionsSource = fs.readFileSync(
  new URL('../src/components/JournalBackupButton.vue', import.meta.url),
  'utf8',
);

const column = source_header => ({ mode: MAPPING_SOURCE_MODE.COLUMN, source_header });
const constant = value => ({ mode: MAPPING_SOURCE_MODE.CONSTANT, value });

const baseMapping = Object.freeze({
  txn_date: column('Trade Date'),
  symbol: column('Ticker'),
  txn_type: column('Side'),
  qty: column('Shares'),
  price: column('Fill Price'),
  currency: column('CCY'),
});

test('explicit source-column mapping produces a canonical zero-write preview without semantic guessing', () => {
  const source = [
    'Trade Date,Ticker,Side,Shares,Fill Price,CCY,Commission,Memo',
    '2026-08-17,NVDA,BUY,2,182.25,USD,-0.25,"manual, row"',
    '2026-08-18,MSFT,SELL,1,500.50,USD,-0.10,second row',
  ].join('\n');

  const result = buildMappedCanonicalTradePreview(source, {
    ...baseMapping,
    fee: column('Commission'),
    note: column('Memo'),
  });

  assert.equal(result.mapping_preview_version, 1);
  assert.equal(result.writes_allowed, false);
  assert.equal(result.source_row_count, 2);
  assert.deepEqual(result.source_headers, [
    'Trade Date', 'Ticker', 'Side', 'Shares', 'Fill Price', 'CCY', 'Commission', 'Memo',
  ]);
  assert.equal(result.canonical_preview.status, 'ready');
  assert.equal(result.canonical_preview.counts.ready, 2);
  assert.deepEqual(result.canonical_preview.rows[0].payload, {
    txn_date: '2026-08-17',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 2,
    price: 182.25,
    fee: -0.25,
    tax: 0,
    tag: '',
    note: 'manual, row',
    currency: 'USD',
    executed_at: null,
    execution_sequence: null,
  });
});

test('explicit constants are limited to reviewed semantic fields and still pass through canonical validation', () => {
  const source = [
    'Date,Ticker,Shares,Price',
    '2026-08-17,NVDA,1,100',
  ].join('\n');

  const result = buildMappedCanonicalTradePreview(source, {
    txn_date: column('Date'),
    symbol: column('Ticker'),
    txn_type: constant('BUY'),
    qty: column('Shares'),
    price: column('Price'),
    currency: constant('USD'),
    tag: constant('Imported'),
  });
  assert.equal(result.canonical_preview.status, 'ready');
  assert.equal(result.canonical_preview.rows[0].payload.txn_type, 'BUY');
  assert.equal(result.canonical_preview.rows[0].payload.currency, 'USD');
  assert.equal(result.canonical_preview.rows[0].payload.tag, 'Imported');

  assert.throws(
    () => buildMappedCanonicalTradePreview(source, {
      txn_date: constant('2026-08-17'),
      symbol: column('Ticker'),
      txn_type: constant('BUY'),
      qty: column('Shares'),
      price: column('Price'),
      currency: constant('USD'),
    }),
    error => error instanceof BrokerNeutralColumnMappingError && error.code === 'CONSTANT_NOT_ALLOWED',
  );
});

test('mapping never normalizes date, side, symbol, currency, signs, or formatted numbers behind the user', () => {
  const source = [
    'Date,Ticker,Side,Shares,Price,CCY',
    '08/17/2026,nvda,Buy,-1,"1,000",usd',
  ].join('\n');

  const result = buildMappedCanonicalTradePreview(source, {
    txn_date: column('Date'),
    symbol: column('Ticker'),
    txn_type: column('Side'),
    qty: column('Shares'),
    price: column('Price'),
    currency: column('CCY'),
  });

  assert.equal(result.canonical_preview.status, 'blocked');
  const codes = new Set(result.canonical_preview.rows[0].issues.map(issue => issue.code));
  assert.ok(codes.has('INVALID_DATE'));
  assert.ok(codes.has('INVALID_SYMBOL'));
  assert.ok(codes.has('UNSUPPORTED_TXN_TYPE'));
  assert.ok(codes.has('NON_POSITIVE_NUMBER'));
  assert.ok(codes.has('INVALID_NUMBER'));
  assert.ok(codes.has('INVALID_CURRENCY'));
});

test('missing required mappings, unknown source columns, duplicate source headers, and malformed source rows fail closed', () => {
  const source = [
    'Date,Ticker,Side,Shares,Price,CCY',
    '2026-08-17,NVDA,BUY,1,100,USD',
  ].join('\n');

  assert.throws(
    () => buildMappedCanonicalTradePreview(source, {
      txn_date: column('Date'),
      symbol: column('Ticker'),
    }),
    error => error instanceof BrokerNeutralColumnMappingError && error.code === 'MISSING_REQUIRED_MAPPING',
  );

  assert.throws(
    () => buildMappedCanonicalTradePreview(source, {
      ...baseMapping,
      txn_date: column('Missing Date'),
    }),
    error => error instanceof BrokerNeutralColumnMappingError && error.code === 'UNKNOWN_SOURCE_HEADER',
  );

  assert.throws(
    () => parseBrokerSourceCsv('Date,Date,Ticker\n2026-08-17,2026-08-17,NVDA'),
    error => error instanceof BrokerNeutralColumnMappingError && error.code === 'DUPLICATE_SOURCE_HEADERS',
  );

  assert.throws(
    () => parseBrokerSourceCsv('Date,Ticker\n2026-08-17,NVDA,EXTRA'),
    error => error instanceof BrokerNeutralColumnMappingError && error.code === 'SOURCE_COLUMN_COUNT_MISMATCH',
  );

  assert.throws(
    () => parseBrokerSourceCsv('Date,Ticker\n2026-08-17,"NVDA"junk'),
    error => error instanceof BrokerNeutralColumnMappingError && error.code === 'MALFORMED_CSV',
  );
});

test('quoted commas, escaped quotes, multiline cells, and CRLF stay deterministic in source mapping', () => {
  const source = [
    'Date,Ticker,Side,Shares,Price,CCY,Memo\r',
    '2026-08-17,NVDA,BUY,1,100,USD,"first, line\r',
    'second says ""done"""\r',
    '',
  ].join('\n');
  const table = parseBrokerSourceCsv(source);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].values[6], 'first, line\r\nsecond says "done"');
});

test('mapping service and UI are structurally zero-write and reuse the existing toolbar slot', () => {
  assert.doesNotMatch(serviceSource, /\bfetch\s*\(|\/api\/|\b(?:POST|PUT|PATCH|DELETE)\b/);
  assert.match(serviceSource, /buildCanonicalTradeCsvPreview/);
  assert.match(serviceSource, /writes_allowed:\s*false/);

  assert.doesNotMatch(mappingComponentSource, /useAuthStore|usePortfolioStore|createBrokerNeutralRecord|runRecordImportBatch|CONFIG\.API_BASE_URL/);
  assert.doesNotMatch(mappingComponentSource, /確認匯入|執行匯入|\/api\//);
  assert.match(mappingComponentSource, /建立零寫入預覽/);
  assert.match(mappingComponentSource, /系統不猜日期格式、BUY\/SELL、幣別、正負號或重複交易/);

  assert.match(toolsComponentSource, /CSV 工具/);
  assert.match(toolsComponentSource, /BrokerNeutralColumnMapping/);
  assert.match(toolsComponentSource, /下載 Canonical CSV 空白範本/);
  assert.match(journalActionsSource, /<BrokerNeutralCsvTemplateButton \/>/);
});
