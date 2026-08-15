import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseIbkrTradeCsv } from '../src/services/ibkrTradeImport.js';

const directHeader = 'AccountID,AssetClass,Symbol,BuySell,Quantity,TradePrice,IBCommission,Taxes,CurrencyPrimary,TradeDate,IBOrderID,TradeID,DateTime,LevelOfDetail,DataDiscriminator';
const directRow = ({
  account = 'U123', asset = 'STK', symbol = 'AAPL', side = 'BUY', qty = '3', price = '200',
  commission = '-0.75', taxes = '0', currency = 'USD', date = '2026-08-14', order = '123456789',
  trade = 'T100', dateTime = '20260814;100000', level = 'EXECUTION', discriminator = 'EXECUTION',
} = {}) => [
  account, asset, symbol, side, qty, price, commission, taxes, currency, date,
  order, trade, dateTime, level, discriminator,
].join(',');

test('aggregates multiple IBKR stock fills by account+order using weighted average and stable order key', () => {
  const csv = [
    directHeader,
    directRow({ symbol: 'NVDA', qty: '10', price: '100', commission: '-1.00', order: '487287953', trade: 'T1', dateTime: '20260814;093001' }),
    directRow({ symbol: 'NVDA', side: 'BOT', qty: '5', price: '110', commission: '-0.50', taxes: '0.10', order: '487287953', trade: 'T2', dateTime: '20260814;093101' }),
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
  assert.equal(entry.source.accountId, 'U123');
  assert.equal(entry.source.fillCount, 2);
  assert.deepEqual(entry.source.tradeIds, ['T1', 'T2']);
  assert.equal(entry.idempotencyKey, 'IBKR~ORDER~20260814~U123~487287953~NVDA~BUY');
  assert.match(entry.record.note, /source=IBKR/);
  assert.doesNotMatch(entry.record.note, /account/i);
  assert.doesNotMatch(entry.record.note, /U123/);
  assert.match(entry.record.note, /order_id=487287953/);
  assert.match(entry.record.note, /fill_count=2/);
});

test('sectioned Trades CSV uses a unique Statement Account fallback and SELL/SLD aliases', () => {
  const csv = [
    'Statement,Header,Field Name,Field Value',
    'Statement,Data,Account,U777',
    'Trades,Header,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Comm/Fee,Buy/Sell,Order ID,Trade ID,Level of Detail,DataDiscriminator',
    'Trades,Data,STK,USD,AMD,20260814;101500,-20,150,-1.25,SLD,90001,TR90001,EXECUTION,EXECUTION',
  ].join('\n');

  const parsed = parseIbkrTradeCsv(csv);
  assert.equal(parsed.status, 'ready');
  assert.equal(parsed.format, 'ibkr-sectioned');
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].source.accountId, 'U777');
  assert.equal(parsed.entries[0].idempotencyKey, 'IBKR~ORDER~20260814~U777~90001~AMD~SELL');
  assert.deepEqual(parsed.entries[0].record, {
    txn_date: '2026-08-14', symbol: 'AMD', txn_type: 'SELL', qty: 20, price: 150,
    fee: 1.25, tax: 0, tag: '', note: parsed.entries[0].record.note,
  });
});

test('multiple Statement Account values cannot be used as an implicit fallback for account-less trade rows', () => {
  const csv = [
    'Statement,Header,Field Name,Field Value',
    'Statement,Data,Account,U111',
    'Statement,Data,Account,U222',
    'Trades,Header,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Comm/Fee,Buy/Sell,Order ID,Trade ID,Level of Detail,DataDiscriminator',
    'Trades,Data,STK,USD,AAPL,20260814;101500,1,200,-0.50,BUY,90001,TR90001,EXECUTION,EXECUTION',
  ].join('\n');

  const parsed = parseIbkrTradeCsv(csv);
  assert.equal(parsed.status, 'invalid');
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings[0].code, 'MISSING_COLUMNS');
  assert.match(parsed.warnings[0].message, /accountId/);
});

test('Order summary/discriminator rows are ignored and do not taint real execution fills', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ symbol: 'NVDA', order: '500', trade: '', level: 'ORDER', discriminator: 'ORDER', qty: '15', price: '105' }),
    directRow({ symbol: 'NVDA', order: '500', trade: 'F1', qty: '10', price: '100' }),
    directRow({ symbol: 'NVDA', order: '500', trade: 'F2', qty: '5', price: '110' }),
  ].join('\n'));

  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].record.qty, 15);
  assert.equal(parsed.warnings.some(item => item.code === 'NON_EXECUTION_ROW'), true);
  assert.equal(parsed.warnings.some(item => item.code === 'ORDER_TAINTED'), false);
});

test('same file parses to identical deterministic account-scoped identities', () => {
  const csv = [directHeader, directRow()].join('\n');
  const first = parseIbkrTradeCsv(csv);
  const second = parseIbkrTradeCsv(csv);
  assert.equal(first.entries[0].idempotencyKey, second.entries[0].idempotencyKey);
  assert.deepEqual(first.entries[0].record, second.entries[0].record);
});

test('identical duplicate TradeID rows are deduplicated within one account', () => {
  const row = directRow();
  const parsed = parseIbkrTradeCsv([directHeader, row, row].join('\n'));
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].record.qty, 3);
  assert.equal(parsed.entries[0].source.fillCount, 1);
  assert.equal(parsed.warnings.some(item => item.code === 'DUPLICATE_TRADE_ID'), true);
});

test('conflicting TradeID taints the whole related order and cannot revive on a later row', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ order: '700', trade: 'T-CONFLICT', qty: '3', price: '200' }),
    directRow({ order: '700', trade: 'T-CONFLICT', qty: '4', price: '201' }),
    directRow({ order: '700', trade: 'T-CONFLICT', qty: '3', price: '200' }),
  ].join('\n'));
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.status, 'invalid');
  assert.equal(parsed.warnings.some(item => item.code === 'CONFLICTING_TRADE_ID'), true);
  assert.equal(parsed.warnings.some(item => item.code === 'ORDER_TAINTED'), true);
  assert.equal(parsed.warnings.some(item => /U123/.test(item.message)), false);
});

test('an invalid execution fill taints its entire order instead of importing an incomplete aggregate', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ symbol: 'NVDA', order: '701', trade: 'GOOD', qty: '5', price: '100' }),
    directRow({ symbol: 'NVDA', order: '701', trade: 'BAD', qty: '5', price: '0' }),
  ].join('\n'));
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings.some(item => item.code === 'INVALID_QUANTITY_OR_PRICE'), true);
  assert.equal(parsed.warnings.some(item => item.code === 'ORDER_TAINTED'), true);
  assert.equal(parsed.warnings.some(item => /U123/.test(item.message)), false);
});

test('same broker order number in different accounts remains two independent durable identities', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ account: 'U111', order: '90001', trade: 'A1', symbol: 'AAPL' }),
    directRow({ account: 'U222', order: '90001', trade: 'B1', symbol: 'AAPL' }),
  ].join('\n'));

  assert.equal(parsed.entries.length, 2);
  assert.notEqual(parsed.entries[0].idempotencyKey, parsed.entries[1].idempotencyKey);
  assert.deepEqual(new Set(parsed.entries.map(entry => entry.source.accountId)), new Set(['U111', 'U222']));
});

test('same order id with mixed symbol/side/date/currency is rejected as one unsafe aggregate', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ order: '777', trade: 'T1', symbol: 'AAPL' }),
    directRow({ order: '777', trade: 'T2', symbol: 'MSFT', price: '400' }),
  ].join('\n'));
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings.some(item => item.code === 'ORDER_IDENTITY_CONFLICT'), true);
  assert.equal(parsed.warnings.some(item => /U123/.test(item.message)), false);
});

test('non-STK and currency/symbol mismatches remain preview warnings and are never importable', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ asset: 'OPT', order: '1', trade: 'T1' }),
    directRow({ symbol: '7203', currency: 'JPY', qty: '100', price: '2500', order: '2', trade: 'T2' }),
    directRow({ symbol: '7203.T', currency: 'JPY', qty: '100', price: '2500', order: '3', trade: 'T3' }),
  ].join('\n'));

  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].record.symbol, '7203.T');
  assert.equal(parsed.warnings.some(item => item.code === 'UNSUPPORTED_ASSET_CLASS'), true);
  assert.equal(parsed.warnings.some(item => item.code === 'CURRENCY_SYMBOL_MISMATCH'), true);
});

test('missing broker account scope, transaction identity, or required columns fail closed', () => {
  const missingAccountColumn = parseIbkrTradeCsv(
    'AssetClass,Symbol,BuySell,Quantity,TradePrice,CurrencyPrimary,TradeDate,IBOrderID,TradeID\nSTK,AAPL,BUY,1,200,USD,2026-08-14,1,T1',
  );
  assert.equal(missingAccountColumn.status, 'invalid');
  assert.equal(missingAccountColumn.warnings[0].code, 'MISSING_COLUMNS');
  assert.match(missingAccountColumn.warnings[0].message, /accountId/);

  const noIdentity = parseIbkrTradeCsv([
    directHeader,
    directRow({ order: '', trade: '' }),
  ].join('\n'));
  assert.equal(noIdentity.entries.length, 0);
  assert.equal(noIdentity.warnings.some(item => item.code === 'MISSING_EXECUTION_ID'), true);

  const missingColumns = parseIbkrTradeCsv('Symbol,Quantity\nAAPL,1');
  assert.equal(missingColumns.status, 'invalid');
  assert.equal(missingColumns.warnings[0].code, 'MISSING_COLUMNS');
});

test('symbols with internal whitespace are not silently rewritten into another ticker', () => {
  const parsed = parseIbkrTradeCsv([
    directHeader,
    directRow({ symbol: 'BRK B', order: '812', trade: 'T812' }),
  ].join('\n'));
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.warnings.some(item => item.code === 'INVALID_SYMBOL'), true);
});

test('parser remains pure and does not call API/store/browser persistence', async () => {
  const source = await readFile(new URL('../src/services/ibkrTradeImport.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|\/api\//);
  assert.match(source, /detectNativeCurrency/);
  assert.match(source, /IDEMPOTENCY_KEY_RE/);
  assert.match(source, /accountId/);
  assert.match(source, /ORDER_TAINTED/);
  assert.match(source, /clientaccountid/);
  assert.match(source, /uniqueAccounts\.length === 1/);
  assert.match(source, /不自動猜測市場 suffix/);
});
