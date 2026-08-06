import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  formatCalendarDateInTimeZone,
  formatLocalCalendarDate,
} from '../src/services/calendarDate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRADE_FORM_PATH = path.join(ROOT, 'src', 'components', 'TradeForm.vue');
const APP_PATH = path.join(ROOT, 'src', 'App.vue');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Asia/Taipei calendar date does not fall back to the previous UTC date', () => {
  const instant = new Date('2026-08-05T16:30:00.000Z');
  assert.equal(instant.toISOString().split('T')[0], '2026-08-05');
  assert.equal(formatCalendarDateInTimeZone(instant, 'Asia/Taipei'), '2026-08-06');
});

test('calendar formatting handles both sides of the Taiwan midnight boundary', () => {
  assert.equal(
    formatCalendarDateInTimeZone(new Date('2026-08-05T15:59:59.999Z'), 'Asia/Taipei'),
    '2026-08-05',
  );
  assert.equal(
    formatCalendarDateInTimeZone(new Date('2026-08-05T16:00:00.000Z'), 'Asia/Taipei'),
    '2026-08-06',
  );
});

test('calendar formatting validates inputs and local formatter returns ISO calendar shape', () => {
  assert.throws(() => formatCalendarDateInTimeZone(new Date('invalid'), 'Asia/Taipei'), /valid Date/);
  assert.throws(() => formatCalendarDateInTimeZone(new Date(), ''), /IANA time zone/);
  assert.match(formatLocalCalendarDate(new Date('2026-08-06T00:00:00.000Z')), /^\d{4}-\d{2}-\d{2}$/);
});

test('TradeForm uses local calendar date for initialization and every reset', () => {
  const source = read(TRADE_FORM_PATH);
  assert.doesNotMatch(source, /toISOString\(\)\.split\(['"]T['"]\)/);
  assert.match(source, /txn_date:\s*formatLocalCalendarDate\(\)/);
  assert.match(source, /const resetForm = \(\) => \{[\s\S]*?form\.txn_date = formatLocalCalendarDate\(\);/);
});

test('TradeForm emits submitted exactly once and only inside successful mutation handling', () => {
  const source = read(TRADE_FORM_PATH);
  assert.match(source, /const emit = defineEmits\(\['submitted'\]\);/);
  assert.equal((source.match(/emit\('submitted'\)/g) || []).length, 1);

  const successBlock = source.match(/if \(success\) \{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.match(successBlock, /resetForm\(\);/);
  assert.match(successBlock, /emit\('submitted'\);/);

  const appSource = read(APP_PATH);
  assert.match(appSource, /<TradeForm[^>]*@submitted="onTradeSubmitted"/);
});

test('editing continues to load the source record date instead of replacing it with today', () => {
  const source = read(TRADE_FORM_PATH);
  const setupBlock = source.match(/const setupForm = \(r\) => \{([\s\S]*?)\n\};\n\ndefineExpose/)?.[1] || '';
  assert.match(setupBlock, /Object\.keys\(form\)\.forEach\(k => form\[k\] = r\[k\]\);/);
  assert.doesNotMatch(setupBlock, /formatLocalCalendarDate/);
});
