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

test('TradeForm emits submitted only after an immediate committed mutation or exact recovered-create confirmation', () => {
  const source = read(TRADE_FORM_PATH);
  assert.match(source, /const emit = defineEmits\(\['submitted'\]\);/);
  assert.equal((source.match(/emit\('submitted'\)/g) || []).length, 2);

  const successStart = source.indexOf('if (success) {');
  const submitCatch = source.indexOf('} catch(e)', successStart);
  const successBlock = source.slice(successStart, submitCatch);
  assert.ok(successStart >= 0 && submitCatch > successStart);
  assert.match(successBlock, /resetForm\(\);/);
  assert.match(successBlock, /emit\('submitted'\);/);

  const recoveryStart = source.indexOf('const unsubscribeRecordCreateRecovery');
  const recoveryEnd = source.indexOf('onUnmounted(', recoveryStart);
  const recoveryBlock = source.slice(recoveryStart, recoveryEnd);
  assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);

  const ownerGuard = recoveryBlock.indexOf('event.owner !== normalizeRecoveryOwner(auth.user?.email)');
  const bodyGuard = recoveryBlock.indexOf('event.body !== unresolvedCreateBody');
  const currentBodyGuard = recoveryBlock.indexOf('if (currentBody !== recoveredBody)');
  const resetAt = recoveryBlock.indexOf('resetForm()');
  const emitAt = recoveryBlock.indexOf("emit('submitted')");
  assert.ok(ownerGuard >= 0);
  assert.ok(bodyGuard > ownerGuard);
  assert.ok(currentBodyGuard > bodyGuard);
  assert.ok(resetAt > currentBodyGuard);
  assert.ok(emitAt > resetAt);

  const appSource = read(APP_PATH);
  assert.match(appSource, /<TradeForm[^>]*@submitted="onTradeSubmitted"/);
});

test('editing continues to load the source record date instead of replacing it with today', () => {
  const source = read(TRADE_FORM_PATH);
  const start = source.indexOf('const setupForm = (r) => {');
  const end = source.indexOf('const normalizeRecoveryOwner', start);
  assert.ok(start >= 0 && end > start);
  const setupBlock = source.slice(start, end);
  assert.match(setupBlock, /Object\.keys\(form\)\.forEach\(k => form\[k\] = r\[k\]\);/);
  assert.doesNotMatch(setupBlock, /formatLocalCalendarDate/);
  assert.match(setupBlock, /unresolvedCreateBody = null/);
});
