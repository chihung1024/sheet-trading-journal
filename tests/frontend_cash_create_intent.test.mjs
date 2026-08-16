import test from 'node:test';
import assert from 'node:assert/strict';
import { beginCashCreateIntent, completeCashCreateIntent, readCashCreateIntent } from '../src/services/cashCreateIntent.js';
import { PENDING_CASH_CREATE_V1_STORAGE_PREFIX, SENSITIVE_PROJECT_STORAGE_PREFIXES } from '../src/services/projectStorage.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
const event = { event_date: '2026-08-16', event_type: 'DEPOSIT', amount: 100, currency: 'USD', note: '' };

test('cash create intent reuses exact idempotency key for the same unresolved payload', () => {
  const storage = new MemoryStorage();
  const options = { now: 1000, createOpaqueId: () => 'cash.create.0123456789abcdef' };
  const first = beginCashCreateIntent(storage, 'USER@EXAMPLE.COM', event, options);
  const replay = beginCashCreateIntent(storage, 'user@example.com', event, { ...options, now: 1100, createOpaqueId: () => 'different.0123456789abcdef' });
  assert.equal(replay.idempotencyKey, first.idempotencyKey);
  assert.equal(readCashCreateIntent(storage, 'user@example.com', { now: 1200 }).event.amount, 100);
});

test('unresolved cash create blocks a different payload until reconciled', () => {
  const storage = new MemoryStorage();
  const now = Date.now();
  const intent = beginCashCreateIntent(storage, 'user@example.com', event, { now, createOpaqueId: () => 'cash.create.0123456789abcdef' });
  assert.throws(() => beginCashCreateIntent(storage, 'user@example.com', { ...event, amount: 200 }, { now: now + 100 }), /上一筆現金新增結果尚未確認/);
  assert.equal(completeCashCreateIntent(storage, 'user@example.com', intent.idempotencyKey), true);
  assert.equal(readCashCreateIntent(storage, 'user@example.com', { now: now + 200 }), null);
});

test('cash intent payload storage is included in sensitive logout cleanup prefixes', () => {
  assert.ok(SENSITIVE_PROJECT_STORAGE_PREFIXES.includes(PENDING_CASH_CREATE_V1_STORAGE_PREFIX));
});
