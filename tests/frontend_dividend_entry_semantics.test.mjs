import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getDividendEntryAmounts,
  getDividendEntryTaxRate,
  getDividendEntryValidationError,
} from '../src/services/dividendPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIVIDEND_MANAGER_PATH = path.join(ROOT, 'src', 'components', 'DividendManager.vue');

const readDividendManager = () => fs.readFileSync(DIVIDEND_MANAGER_PATH, 'utf8');

test('dividend entry contract derives net from gross minus withholding tax', () => {
  assert.deepEqual(
    getDividendEntryAmounts({ amount: 100, tax: 30 }),
    { gross: 100, tax: 30, net: 70 },
  );
  assert.equal(getDividendEntryTaxRate({ amount: 100, tax: 30 }), 30);
  assert.equal(getDividendEntryTaxRate({ amount: 0, tax: 0 }), 0);
});

test('dividend entry validation blocks amounts that cannot safely become a DIV net cashflow', () => {
  assert.equal(
    getDividendEntryValidationError({ amount: 0, tax: 0 }),
    '請輸入大於 0 的稅前配息總額',
  );
  assert.equal(
    getDividendEntryValidationError({ amount: -1, tax: 0 }),
    '請輸入大於 0 的稅前配息總額',
  );
  assert.equal(
    getDividendEntryValidationError({ amount: 'not-a-number', tax: 0 }),
    '請輸入大於 0 的稅前配息總額',
  );
  assert.equal(
    getDividendEntryValidationError({ amount: 100, tax: -1 }),
    '預扣稅金不可小於 0',
  );
  assert.equal(
    getDividendEntryValidationError({ amount: 100, tax: 101 }),
    '預扣稅金不可大於稅前配息總額',
  );
  assert.equal(getDividendEntryValidationError({ amount: 100, tax: 100 }), '');
  assert.equal(getDividendEntryValidationError({ amount: 100, tax: 30 }), '');
});

test('DividendManager presents one gross-tax-net contract on desktop and mobile', () => {
  const source = readDividendManager();

  assert.match(source, /稅前配息總額/);
  assert.match(source, /預扣稅金/);
  assert.match(source, /實際入帳淨額/);
  assert.match(source, /稅前配息總額 − 預扣稅金 = 實際入帳淨額/);
  assert.doesNotMatch(source, /實發總額/);
  assert.match(source, /getDividendEntryAmounts\(div\)/);
  assert.match(source, /getDividendEntryValidationError\(div\)/);
  assert.match(source, /getDividendEntryTaxRate\(div\)/);
});

test('DividendManager confirmation explicitly states the authoritative DIV journal record outcome', () => {
  const source = readDividendManager();

  assert.match(source, /確認建立 \$\{div\.symbol\} 的 DIV 交易/);
  assert.match(source, /交易紀錄將以上述除息日與淨額入帳/);
  assert.match(source, /txn_date: div\.ex_date/);
  assert.match(source, /txn_type: 'DIV'/);
  assert.match(source, /qty: 1/);
  assert.match(source, /price: netAmount/);
  assert.match(source, /tax: 0/);
  assert.match(source, /tag: 'Auto-Dividend'/);
});

test('Phase 10.2A preserves deterministic dividend replay payload identity', () => {
  const source = readDividendManager();

  assert.match(source, /buildDividendEventIdempotencyKey\(\{\s*symbol: div\.symbol,\s*date: div\.ex_date,/s);
  assert.match(
    source,
    /const taxInfo = finalTax > 0 \? `稅金:\$\{currency\} \$\{formatNumber\(finalTax, 2\)\}` : '';/,
  );
  assert.match(source, /withRecordCreateIdempotencyKey\(\{/);
  assert.match(source, /store\.addRecord\(record, \{ returnOutcome: true \}\)/);
  assert.match(source, /DIVIDEND_EVENT_CONFLICT/);
});
