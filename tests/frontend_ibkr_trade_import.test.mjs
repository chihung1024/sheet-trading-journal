import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseIbkrTradeCsv } from '../src/services/ibkrTradeImport.js';

const directHeader = 'AssetClass,Symbol,BuySell,Quantity,TradePrice,IBCommission,Taxes,CurrencyPrimary,TradeDate,IBOrderID,TradeID,DateTime,LevelOfDetail';

test('aggregates multiple IBKR stock fills by order using weighted average and stable order key', () => {
  const csv = [
    directHeader,
    'STK,NVDA,BUY,10,100,-1.00,0,USD,2026-08-14,487287953,T1,20260814;093001,EXECUTION',
    'STK,NVDA,BOT,5,110,-0.50,0.10,USD,2026-08-14,487287953,T2,20260814;093101,EXECUTION',
  ].join('\n');

  const parsed = parseIbkrTradeCsv(csv);
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.warnings.length, 0);

  const entry = parsed.entries[0];
  assert.equal(entry.record.txn_date, '2026-08-14');
  assert.equal(entry.record.symbol, 'NVDA');
  assert.equal(entry.record.txn_type, 'BUY');
  assert.equal(entry.record.qty, 15);
  assert.equal(entry.record.price, (10 * 100 + 5 * 110) / 15);
  assert.equal(entry.record.fee, 1.5);
  assert.equal(entry.record.tax, 0.1);
  assert.equal(entry.source.fillCount, 2);
  assert.deepEqual(entry.source.tradeIds, ['T1', 'T2']);
  assert.equal(entry.idempotencyKey, 'IBKR~ORDER~20260814~487287953~NVDA~BUY');
  assert.match(entry.record.note, /source=IBKR/);
  assert.match(entry.record.note, /order_id=487287953/);
  assert.match(entry.record.note, /fill_count=2/);
});

test('supports IBKR sectioned Trades CSV and SELL/SLD aliases', () => {
  const csv = [
    'Statement,Header,Field Name,Field Value',
    'Statement,Data,Account,TEST',
    'Trades,Header,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Comm/Fee,Buy/Sell,Order ID,Trade ID,Level of Detail',
    'Trades,Data,STK,USD,AMD,20260814;101500,-20,150,-1.25,SLD,90001,TR90001,EXECUTION',
  ].join('\n');

  const parsed = parseIbkrTradeCsv(csv);
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.format, 'ibkr-sectioned');
  assert.equal(parsed.entries.length, 1);
  assert.deepEqual(parsed.entries[0].record, {
    txn_date: '2026-08-14',
    symbol: 'AMD',
    txn_type: 'SELL',
    qty: 20,
    price: 150,
    fee: 1.25,
    tax: 0,
    tag: '',
    note: parsed.entries[0].record.note,
  });
});

test('same file parses to identical deterministic idempotency keys', () => {
  const csv = [
    directHeader,
    'STK,AAPL,BUY,3,200,-0.75,0,USD,2026-08-14,123456789,T100,20260814;100000,EXECUTION',
  ].join('\n');
  const first = parseIbkrTradeCsv(csv);
  const second = parseIbkrTradeCsv(csv);
  assert.equal(first.entries[0].idempotencyKey, second.entries[0].idempotencyKey);
  assert.deepEqual(first.entries[0].record, second.entries[0].record);
});

test('identical duplicate TradeID rows are deduplicated within one file', () => {
  const row = 'STK,AAPL,BUY,3,200,-0.75,0,USD,2026-08-14,123456789,T100,20260814;100000,EXECUTION';
  const parsed = parseIbkrTradeCsv([directHeader, row, row].join('\n'));
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].record.qty, 3);
  assert.equal(parsed.entries[0].source.fillCount, 1);
  assert.equal(parsed.warnings.some(item => item.code === 'DUPLICATE_TRADE_ID'), true);
});

test('conflicting duplicate TradeID fails that execution closed', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    'STK,AAPL,BUY,3,200,-0.75,0,USD,2026-08-14,123456789,T100,20260814;100000,EXECUTION',
    'STK,AAPL,BUY,4,201,-0.75,0,USD,2026-08-14,123456789,T100,20260814;100001,EXECUTION',
  ].join('\n'));
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.status, 'invalid');
  assert.equal(parsed.warnings.some(item => item.code === 'CONFLICTING_TRADE_ID'), true);
});

test('same order id with mixed symbol/side/date/currency is rejected as one unsafe aggregate', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    'STK,AAPL,BUY,3,200,-0.75,0,USD,2026-08-14,777,T1,20260814;100000,EXECUTION',
    'STK,MSFT,BUY,3,400,-0.75,0,USD,2026-08-14,777,T2,20260814;100100,EXECUTION',
  ].join('\n'));
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings.some(item => item.code === 'ORDER_IDENTITY_CONFLICT'), true);
});

test('non-STK and currency/symbol mismatches remain preview warnings and are never importable', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    'OPT,AAPL,BUY,1,10,-1,0,USD,2026-08-14,1,T1,20260814;100000,EXECUTION',
    'STK,7203,BUY,100,2500,-10,0,JPY,2026-08-14,2,T2,20260814;100000,EXECUTION',
    'STK,7203.T,BUY,100,2500,-10,0,JPY,2026-08-14,3,T3,20260814;100000,EXECUTION',
  ].join('\n'));

  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].record.symbol, '7203.T');
  assert.equal(parsed.warnings.some(item => item.code === 'UNSUPPORTED_ASSET_CLASS'), true);
  assert.equal(parsed.warnings.some(item => item.code === 'CURRENCY_SYMBOL_MISMATCH'), true);
});

test('missing identity or required columns fail closed', () => {
  const noIdentity = parseIbkrTradeCsv([
    directHeader,
    'STK,AAPL,BUY,1,200,-1,0,USD,2026-08-14,,,20260814;100000,EXECUTION',
  ].join('\n'));
  assert.equal(noIdentity.entries.length, 0);
  assert.equal(noIdentity.warnings.some(item => item.code === 'MISSING_EXECUTION_ID'), true);

  const missingColumns = parseIbkrTradeCsv('Symbol,Quantity\nAAPL,1');
  assert.equal(missingColumns.status, 'invalid');
  assert.equal(missingColumns.warnings[0].code, 'MISSING_COLUMNS');
});

test('parser remains pure and does not call API/store/browser persistence', async () => {
  const source = await readFile(new URL('../src/services/ibkrTradeImport.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|\/api\//);
  assert.match(source, /detectNativeCurrency/);
  assert.match(source, /IDEMPOTENCY_KEY_RE/);
  assert.match(source, /不自動猜測市場 suffix/);
});