import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../migrations/0005_cash_events_expand.sql', import.meta.url),
  'utf8',
);

test('R2.3A cash-event expansion is additive and does not activate a new schema contract', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS cash_events/i);
  assert.doesNotMatch(migration, /ALTER TABLE records/i);
  assert.doesNotMatch(migration, /UPDATE\s+schema_metadata/i);
});

test('cash_events stores only the reviewed explicit external cash event classes', () => {
  assert.match(
    migration,
    /CHECK\s*\(event_type IN \('OPENING_BALANCE', 'DEPOSIT', 'WITHDRAWAL'\)\)/i,
  );
  assert.doesNotMatch(migration, /\bADJUSTMENT\b/i);
  assert.match(migration, /CHECK\s*\(event_type = 'OPENING_BALANCE' OR amount > 0\)/i);
});

test('cash currency is an actual uppercase three-letter currency code, not a quote unit such as GBp', () => {
  assert.match(migration, /length\(currency\) = 3/i);
  assert.match(migration, /currency = upper\(currency\)/i);
  assert.match(migration, /currency GLOB '\[A-Z\]\[A-Z\]\[A-Z\]'/i);
  assert.doesNotMatch(migration, /['"]GBp['"]/);
});

test('cash events reserve tenant-scoped create idempotency and one consolidated opening balance per currency', () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_events_user_create_idempotency[\s\S]*ON cash_events \(user_id, create_idempotency_hash\)/i,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_events_user_currency_opening[\s\S]*ON cash_events \(user_id, currency\)[\s\S]*WHERE event_type = 'OPENING_BALANCE'/i,
  );
  assert.match(migration, /create_idempotency_hash TEXT[\s\S]*length\(create_idempotency_hash\) = 64/i);
  assert.match(migration, /create_payload_hash TEXT[\s\S]*length\(create_payload_hash\) = 64/i);
});

test('cash-event model keeps event time unknown instead of reusing database timestamps as financial chronology', () => {
  assert.match(migration, /created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP/i);
  assert.match(migration, /updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP/i);
  assert.doesNotMatch(migration, /executed_at/i);
  assert.doesNotMatch(migration, /execution_sequence/i);
});
