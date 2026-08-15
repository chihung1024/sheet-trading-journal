import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildConfirmedDividendKeySet,
  buildDividendEventKey,
  getDividendRecordEventKey,
  getPendingDividendEventKey,
  isDividendConfirmedByRecords,
} from '../src/services/dividendConfirmation.js';

test('dividend confirmation key mirrors engine Symbol + Date semantics', () => {
  assert.equal(
    buildDividendEventKey({ symbol: ' lly ', date: '2026-08-14' }),
    'LLY_2026-08-14',
  );
  assert.equal(getPendingDividendEventKey({ symbol: 'LLY', ex_date: '2026-08-14' }), 'LLY_2026-08-14');
  assert.equal(
    getDividendRecordEventKey({ symbol: 'lly', txn_date: '2026-08-14', txn_type: 'div' }),
    'LLY_2026-08-14',
  );
});

test('only authoritative DIV records confirm a pending dividend', () => {
  const confirmed = buildConfirmedDividendKeySet([
    { symbol: 'LLY', txn_date: '2026-08-14', txn_type: 'BUY' },
    { symbol: 'AAPL', txn_date: '2026-08-14', txn_type: 'DIV' },
    { symbol: 'LLY', txn_date: '2026-08-14', txn_type: 'DIV', tag: 'Manual' },
  ]);

  assert.equal(confirmed.has('LLY_2026-08-14'), true);
  assert.equal(confirmed.has('AAPL_2026-08-14'), true);
  assert.equal(isDividendConfirmedByRecords({ symbol: 'LLY', ex_date: '2026-08-14' }, confirmed), true);
  assert.equal(isDividendConfirmedByRecords({ symbol: 'LLY', ex_date: '2026-08-15' }, confirmed), false);
});

test('invalid or incomplete event identity fails closed', () => {
  assert.equal(buildDividendEventKey({ symbol: '', date: '2026-08-14' }), null);
  assert.equal(buildDividendEventKey({ symbol: 'LLY', date: '08/14/2026' }), null);
  assert.equal(getDividendRecordEventKey({ symbol: 'LLY', txn_date: '2026-08-14', txn_type: 'SELL' }), null);
  assert.equal(isDividendConfirmedByRecords({ symbol: 'LLY' }, new Set(['LLY_2026-08-14'])), false);
  assert.deepEqual([...buildConfirmedDividendKeySet(null)], []);
});

test('DividendManager no longer uses device-local confirmed-dividend authority', async () => {
  const source = await readFile(new URL('../src/components/DividendManager.vue', import.meta.url), 'utf8');

  assert.match(source, /buildConfirmedDividendKeySet/);
  assert.match(source, /isDividendConfirmedByRecords/);
  assert.doesNotMatch(source, /confirmed_dividend_keys/);
  assert.doesNotMatch(source, /loadConfirmedKeys|saveConfirmedKeys/);
  assert.doesNotMatch(source, /confirmedKeys\.value\.(add|delete)/);
  assert.doesNotMatch(source, /subscribeRecordCreateRecoverySuccess/);
  assert.match(source, /const confirmedDividendKeys = computed\(\(\) => buildConfirmedDividendKeySet\(store\.records\)\)/);
});
