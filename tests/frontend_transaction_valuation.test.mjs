import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  isSnapshotRecordVerified,
  isSnapshotVerificationCurrent,
  publishSnapshotVerification,
} from '../src/services/snapshotVerification.js';
import {
  resolveAuthoritativeTransactionFx,
  resolveNetCashflowNative,
  resolveSettlementAmountNative,
  resolveTransactionValuation,
} from '../src/services/transactionValuation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const makeSnapshot = () => ({
  history: [
    {
      date: '2026-08-04',
      fx_rate: 31.91,
      _raw_fx_rates: {
        TWD: 1,
        USD: 31.912345,
        KRW: 0.02215,
        HKD: 4.081,
        JPY: 0.217,
        EUR: 37.12,
        GBp: 0.431,
        CNY: 4.45,
      },
    },
    {
      date: '2026-08-05',
      fx_rate: 32.02,
      _raw_fx_rates: { TWD: 1, USD: 32.021234, KRW: 0.02222 },
    },
  ],
});

const makeBaseRecord = () => ({
  id: 1,
  txn_date: '2026-08-04',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 10,
  price: 100,
  fee: 5,
  tax: 1,
});

test('transaction native cash flow mirrors current Python BUY/SELL/DIV semantics', () => {
  const baseRecord = makeBaseRecord();
  assert.equal(resolveNetCashflowNative(baseRecord), -1006);
  assert.equal(resolveSettlementAmountNative(baseRecord), 1006);

  const sell = { ...baseRecord, txn_type: 'SELL' };
  assert.equal(resolveNetCashflowNative(sell), 994);
  assert.equal(resolveSettlementAmountNative(sell), 994);

  const dividend = { ...baseRecord, txn_type: 'DIV' };
  assert.equal(resolveNetCashflowNative(dividend), 1000);
  assert.equal(resolveSettlementAmountNative(dividend), 1000);

  // Worker accepts any finite fee/tax and prepare_transactions preserves sign.
  // Keep the browser projection identical to the actual calculator rather than
  // silently normalizing historical/source data differently.
  const negativeCosts = { ...baseRecord, fee: -5, tax: -1 };
  assert.equal(resolveNetCashflowNative(negativeCosts), -994);
  assert.equal(resolveNetCashflowNative({ ...negativeCosts, txn_type: 'SELL' }), 1006);

  assert.equal(resolveNetCashflowNative({ ...baseRecord, qty: 0 }), null);
  assert.equal(resolveNetCashflowNative({ ...baseRecord, price: -1 }), null);
  assert.equal(resolveNetCashflowNative({ ...baseRecord, txn_type: 'TRANSFER' }), null);
});

test('foreign FX remains unavailable until Phase 3 verifies the exact snapshot and record objects', () => {
  const snapshot = makeSnapshot();
  const record = { ...makeBaseRecord(), symbol: '005930.KS' };
  const records = [record];

  assert.equal(resolveAuthoritativeTransactionFx(snapshot, record), null);
  assert.equal(isSnapshotVerificationCurrent(snapshot, records), false);
  assert.equal(isSnapshotRecordVerified(snapshot, record), false);

  assert.equal(publishSnapshotVerification(snapshot, records), true);
  assert.equal(isSnapshotVerificationCurrent(snapshot, records), true);
  assert.equal(isSnapshotRecordVerified(snapshot, record), true);
  assert.deepEqual(resolveAuthoritativeTransactionFx(snapshot, record), {
    currency: 'KRW',
    fxRate: 0.02215,
    source: 'snapshot-fx-context',
  });

  // A new API read replaces record objects; an old integrity proof cannot
  // authorize the new record set even when values happen to be identical.
  const replacedRecord = { ...record };
  assert.equal(isSnapshotRecordVerified(snapshot, replacedRecord), false);
  assert.equal(resolveAuthoritativeTransactionFx(snapshot, replacedRecord), null);

  const replacedSnapshot = { ...snapshot, history: [...snapshot.history] };
  assert.equal(isSnapshotRecordVerified(replacedSnapshot, record), false);
  assert.equal(resolveAuthoritativeTransactionFx(replacedSnapshot, record), null);
});

test('currency-aware FX comes only from the exact transaction-date Python snapshot context', () => {
  const snapshot = makeSnapshot();
  const krw = { ...makeBaseRecord(), symbol: '005930.KS' };
  publishSnapshotVerification(snapshot, [krw]);
  assert.deepEqual(resolveAuthoritativeTransactionFx(snapshot, krw), {
    currency: 'KRW',
    fxRate: 0.02215,
    source: 'snapshot-fx-context',
  });

  const missingDate = { ...krw, txn_date: '2026-08-03' };
  publishSnapshotVerification(snapshot, [missingDate]);
  assert.equal(resolveAuthoritativeTransactionFx(snapshot, missingDate), null);

  const missingCurrencySnapshot = {
    history: [{ date: '2026-08-04', _raw_fx_rates: { TWD: 1, USD: 31.9 } }],
  };
  const missingCurrencyRecord = { ...krw };
  publishSnapshotVerification(missingCurrencySnapshot, [missingCurrencyRecord]);
  assert.equal(resolveAuthoritativeTransactionFx(missingCurrencySnapshot, missingCurrencyRecord), null);

  const twd = { ...makeBaseRecord(), symbol: '2330.TW' };
  assert.deepEqual(resolveAuthoritativeTransactionFx({}, twd), {
    currency: 'TWD',
    fxRate: 1,
    source: 'base-currency',
  });
});

test('legacy scalar FX is an exact-date verified USD-only compatibility path', () => {
  const legacy = { history: [{ date: '2026-08-04', fx_rate: 31.9876 }] };
  const usd = makeBaseRecord();
  publishSnapshotVerification(legacy, [usd]);
  assert.deepEqual(resolveAuthoritativeTransactionFx(legacy, usd), {
    currency: 'USD',
    fxRate: 31.9876,
    source: 'legacy-usd-reference',
  });

  const jpy = { ...makeBaseRecord(), symbol: '7203.T' };
  publishSnapshotVerification(legacy, [jpy]);
  assert.equal(resolveAuthoritativeTransactionFx(legacy, jpy), null);
});

test('resolved TWD settlement uses verified authoritative date FX and preserves direction internally', () => {
  const snapshot = makeSnapshot();
  const buyRecord = makeBaseRecord();
  const krwSellRecord = {
    ...makeBaseRecord(),
    id: 2,
    symbol: '005930.KS',
    txn_type: 'SELL',
    qty: 2,
    price: 50000,
    fee: 100,
    tax: 50,
  };
  publishSnapshotVerification(snapshot, [buyRecord, krwSellRecord]);

  const buy = resolveTransactionValuation(snapshot, buyRecord);
  assert.equal(buy.currency, 'USD');
  assert.equal(buy.fxSource, 'snapshot-fx-context');
  assert.equal(buy.netCashflowNative, -1006);
  assert.equal(buy.settlementAmountNative, 1006);
  assert.equal(buy.netCashflowTwd, -1006 * 31.912345);
  assert.equal(buy.settlementAmountTwd, 1006 * 31.912345);

  const krwSell = resolveTransactionValuation(snapshot, krwSellRecord);
  assert.equal(krwSell.netCashflowNative, 99850);
  assert.equal(krwSell.settlementAmountTwd, 99850 * 0.02215);
});

test('frontend consumes existing authoritative contracts without inventing FX or fee normalization', () => {
  const recordList = read('src/components/RecordList.vue');
  const valuation = read('src/services/transactionValuation.js');
  const selfHealing = read('src/services/snapshotSelfHealing.js');
  const calculator = read('journal_engine/core/calculator.py');
  const runner = read('main.py');
  const worker = read('worker.js');
  const apiClient = read('journal_engine/clients/api_client.py');

  assert.match(recordList, /resolveTransactionValuation\(store\.rawData, record\)/);
  assert.match(recordList, /store\.snapshotFreshness !== 'loaded'/);
  assert.doesNotMatch(recordList, /fxRateMap/);
  assert.doesNotMatch(recordList, /getFxRateByDate/);
  assert.doesNotMatch(recordList, /canConvertWithLegacyUsdTwdRate/);

  assert.match(valuation, /row\._raw_fx_rates/);
  assert.match(valuation, /snapshot\.history\.find/);
  assert.match(valuation, /isSnapshotRecordVerified\(snapshot, record\)/);
  assert.doesNotMatch(valuation, /Math\.abs\(commission\)/);
  assert.doesNotMatch(valuation, /Math\.abs\(tax\)/);
  assert.doesNotMatch(valuation, /sort\(\)/);
  assert.doesNotMatch(valuation, /<= target/);
  assert.doesNotMatch(valuation, /32\.0/);

  assert.match(selfHealing, /const assessedRecords = portfolio\.records/);
  assert.match(selfHealing, /const assessedSnapshot = portfolio\.rawData/);
  assert.match(selfHealing, /publishSnapshotVerification\(assessedSnapshot, assessedRecords\)/);

  assert.match(calculator, /cost_usd = \(row\['Qty'\] \* row\['Price'\]\) \+ row\['Commission'\] \+ row\['Tax'\]/);
  assert.match(calculator, /proceeds_twd = \(\(executable_qty \* row\['Price'\]\) - executed_commission - executed_tax\) \* effective_fx/);
  assert.match(calculator, /"_raw_fx_rates": self\._serialize_fx_context\(/);
  assert.match(runner, /df\[column\] = pd\.to_numeric\(df\[column\], errors="raise"\)\.fillna\(0\.0\)/);
  assert.match(worker, /fee: optionalFiniteNumber\(body\.fee, "fee", 0\)/);
  assert.match(worker, /tax: optionalFiniteNumber\(body\.tax, "tax", 0\)/);
  assert.match(apiClient, /snapshot\.model_dump\(mode="json"\)/);
});
