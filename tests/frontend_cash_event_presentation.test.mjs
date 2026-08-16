import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDateAtOffset, formatCashEventAmount } from '../src/services/cashEventPresentation.js';

test('cash presentation preserves signed opening balances and uses direction only for movements', () => {
  assert.equal(formatCashEventAmount({ event_type: 'OPENING_BALANCE', amount: -250.25 }, 'en-US'), '-250.25');
  assert.equal(formatCashEventAmount({ event_type: 'OPENING_BALANCE', amount: 0 }, 'en-US'), '0');
  assert.equal(formatCashEventAmount({ event_type: 'DEPOSIT', amount: 1000 }, 'en-US'), '+1,000');
  assert.equal(formatCashEventAmount({ event_type: 'WITHDRAWAL', amount: 1000 }, 'en-US'), '-1,000');
});

test('cash default calendar semantics can cross UTC midnight using the browser timezone offset', () => {
  const instant = new Date('2026-08-16T16:30:00.000Z');
  assert.equal(calendarDateAtOffset(instant, -480), '2026-08-17'); // Asia/Taipei
  assert.equal(calendarDateAtOffset(instant, 420), '2026-08-16'); // UTC-07:00
});
