import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  canConvertWithLegacyUsdTwdRate,
  detectNativeCurrency,
  formatNativeAmount,
  getCurrencyInputAffix,
} from '../src/services/instrumentCurrency.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRADE_FORM_PATH = path.join(ROOT, 'src', 'components', 'TradeForm.vue');
const RECORD_LIST_PATH = path.join(ROOT, 'src', 'components', 'RecordList.vue');
const TRANSACTION_VALUATION_PATH = path.join(ROOT, 'src', 'services', 'transactionValuation.js');
const PYTHON_CURRENCY_PATH = path.join(ROOT, 'journal_engine', 'core', 'currency_detector.py');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('frontend native-currency detection matches the supported Python market suffix contract', () => {
  const cases = [
    ['NVDA', 'USD'],
    ['brk.b', 'USD'],
    ['2330.TW', 'TWD'],
    ['6488.TWO', 'TWD'],
    ['005930.KS', 'KRW'],
    ['247540.KQ', 'KRW'],
    ['0700.HK', 'HKD'],
    ['0005.HKG', 'HKD'],
    ['600519.SS', 'CNY'],
    ['000001.SZ', 'CNY'],
    ['7203.T', 'JPY'],
    ['VOD.L', 'GBp'],
    ['AIR.PA', 'EUR'],
    ['SAP.DE', 'EUR'],
  ];

  for (const [symbol, expected] of cases) {
    assert.equal(detectNativeCurrency(`  ${symbol}  `), expected, symbol);
  }

  const pythonSource = read(PYTHON_CURRENCY_PATH);
  for (const [currency, suffixes] of [
    ['TWD', ['.TW', '.TWO']],
    ['KRW', ['.KS', '.KQ']],
    ['HKD', ['.HK', '.HKG']],
    ['CNY', ['.SS', '.SZ']],
    ['JPY', ['.T']],
    ['GBp', ['.L']],
    ['EUR', ['.PA', '.DE']],
  ]) {
    assert.ok(pythonSource.includes(`'${currency}': [${suffixes.map(value => `'${value}'`).join(', ')}]`));
  }
});

test('currency presentation is native-aware and legacy scalar FX is limited to TWD/USD', () => {
  assert.equal(getCurrencyInputAffix('TWD'), 'NT$');
  assert.equal(getCurrencyInputAffix('USD'), '$');
  assert.equal(getCurrencyInputAffix('KRW'), '₩');
  assert.equal(getCurrencyInputAffix('HKD'), 'HK$');
  assert.equal(getCurrencyInputAffix('CNY'), 'CN¥');
  assert.equal(getCurrencyInputAffix('JPY'), '¥');
  assert.equal(getCurrencyInputAffix('GBp'), 'GBp');
  assert.equal(getCurrencyInputAffix('EUR'), '€');

  assert.equal(formatNativeAmount(1234.5, 'USD', 2), '$1,234.50');
  assert.equal(formatNativeAmount(1234.5, 'TWD', 0), 'NT$1,235');
  assert.equal(formatNativeAmount(1234.5, 'GBp', 2), '1,234.50 GBp');
  for (const missing of [null, undefined, '', '   ', false, Number.NaN]) {
    assert.equal(formatNativeAmount(missing, 'JPY', 2), '—');
  }

  assert.equal(canConvertWithLegacyUsdTwdRate('TWD'), true);
  assert.equal(canConvertWithLegacyUsdTwdRate('USD'), true);
  for (const currency of ['KRW', 'HKD', 'CNY', 'JPY', 'GBp', 'EUR']) {
    assert.equal(canConvertWithLegacyUsdTwdRate(currency), false, currency);
  }
});

test('TradeForm prefers confirmed currency while keeping Symbol detection as suggestion/fallback', () => {
  const source = read(TRADE_FORM_PATH);
  assert.match(source, /detectNativeCurrency/);
  assert.match(source, /normalizeNativeCurrency/);
  assert.match(source, /getCurrencyInputAffix/);
  assert.match(source, /const detectedCurrency = computed\(\(\) => detectNativeCurrency\(normalizedSymbol\.value\)\);/);
  assert.match(source, /normalizeNativeCurrency\(form\.currency\) \|\| detectedCurrency\.value/);
  assert.match(source, /if \(!isEditing\.value && !currencyUserEdited\.value\) \{\s*form\.currency = detectNativeCurrency\(symbol\);/s);
  assert.doesNotMatch(source, /const transactionCurrency = computed\(\(\) => detectNativeCurrency\(normalizedSymbol\.value\)\);/);
  assert.doesNotMatch(source, /const isTaiwanSymbol/);
  assert.doesNotMatch(source, /transactionCurrency\.value === 'TWD' \? 'NT\$' : '\$'/);
});

test('RecordList delegates TWD valuation without restoring the old non-TWD-as-USD fallback', () => {
  const recordList = read(RECORD_LIST_PATH);
  const valuation = read(TRANSACTION_VALUATION_PATH);

  assert.match(recordList, /detectNativeCurrency/);
  assert.match(recordList, /resolveTransactionValuation/);
  assert.match(recordList, /resolveSettlementAmountNative/);
  assert.match(recordList, /TWD 尚無可靠換算/);
  assert.match(recordList, /formatNativeAmount\(getRecordAvgPrice\(r\), getRecordCurrency\(r\), 2\)/);
  assert.doesNotMatch(recordList, /isTaiwanStock/);
  assert.doesNotMatch(recordList, /32\.0/);
  assert.doesNotMatch(recordList, /calculateTotalAmountUSD/);
  assert.doesNotMatch(recordList, /canConvertWithLegacyUsdTwdRate/);

  assert.match(valuation, /detectNativeCurrency/);
  assert.match(valuation, /row\._raw_fx_rates/);
  assert.match(valuation, /currency === 'USD'/);
  assert.doesNotMatch(valuation, /32\.0/);
});
