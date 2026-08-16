import test from 'node:test';
import assert from 'node:assert/strict';
import { createCashEvent, deleteCashEvent, fetchCashEvents, normalizeCashEventState, updateCashEvent } from '../src/services/cashEventApi.js';

const token = 'signed-token';
const base = 'https://api.example.test';
const event = { event_date: '2026-08-16', event_type: 'DEPOSIT', amount: 100, currency: 'USD', note: 'funding' };
const row = { id: 7, ...event, event_source: 'MANUAL', created_at: 'x', updated_at: 'x' };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

test('cash event normalization preserves signed opening balance and positive movement contract', () => {
  assert.equal(normalizeCashEventState({ ...event, event_type: 'OPENING_BALANCE', amount: -50 }).amount, -50);
  assert.equal(normalizeCashEventState({ ...event, event_type: 'OPENING_BALANCE', amount: 0 }).amount, 0);
  assert.throws(() => normalizeCashEventState({ ...event, amount: 0 }), /greater than zero/);
  assert.equal(normalizeCashEventState({ ...event, currency: 'usd' }).currency, 'USD');
});

test('cash API uses bearer auth, durable POST key and exact expected state without calculation calls', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    if (init.method === 'GET') return response({ success: true, cash_events: [row] });
    if (init.method === 'POST') return response({ success: true, cash_event: row, deduplicated: false }, 201);
    if (init.method === 'PUT') return response({ success: true, cash_event: { ...row, amount: 120 } });
    if (init.method === 'DELETE') return response({ success: true, deleted: true });
    throw new Error('unexpected method');
  };
  const common = { apiBaseUrl: base, token, fetchImpl };
  assert.equal((await fetchCashEvents(common))[0].id, 7);
  await createCashEvent({ ...common, event, idempotencyKey: 'cash.create.0123456789abcdef' });
  await updateCashEvent({ ...common, id: 7, expected: event, event: { ...event, amount: 120 } });
  await deleteCashEvent({ ...common, id: 7, expected: event });
  assert.deepEqual(calls.map(call => call.init.method), ['GET', 'POST', 'PUT', 'DELETE']);
  assert.equal(calls[1].init.headers['Idempotency-Key'], 'cash.create.0123456789abcdef');
  assert.deepEqual(calls[2].body.expected, event);
  assert.deepEqual(calls[3].body.expected, event);
  assert.ok(calls.every(call => call.url === `${base}/api/cash-events`));
  assert.ok(calls.every(call => call.init.headers.Authorization === `Bearer ${token}`));
});

test('cash mutation HTTP conflicts remain definite rather than ambiguous', async () => {
  const fetchImpl = async () => response({ success: false, error: 'changed', error_meta: { code: 'CASH_EVENT_CHANGED' } }, 409);
  await assert.rejects(
    () => updateCashEvent({ apiBaseUrl: base, token, fetchImpl, id: 7, expected: event, event }),
    error => error.status === 409 && error.apiCode === 'CASH_EVENT_CHANGED' && error.outcomeAmbiguous === false,
  );
});
