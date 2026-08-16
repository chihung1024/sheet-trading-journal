-- R2.3A: additive explicit cash-event storage foundation.
-- This migration intentionally leaves schema_metadata unchanged so the current
-- schema-v3 Worker remains compatible while the new table stays inert until a
-- separately reviewed API/ledger activation batch.

CREATE TABLE IF NOT EXISTS cash_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('OPENING_BALANCE', 'DEPOSIT', 'WITHDRAWAL')),
  amount REAL NOT NULL
    CHECK (event_type = 'OPENING_BALANCE' OR amount > 0),
  currency TEXT NOT NULL
    CHECK (
      length(currency) = 3
      AND currency = upper(currency)
      AND currency GLOB '[A-Z][A-Z][A-Z]'
    ),
  note TEXT NOT NULL DEFAULT '',
  event_source TEXT,
  create_idempotency_hash TEXT
    CHECK (create_idempotency_hash IS NULL OR length(create_idempotency_hash) = 64),
  create_payload_hash TEXT
    CHECK (create_payload_hash IS NULL OR length(create_payload_hash) = 64),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_events_user_date_id
  ON cash_events (user_id, event_date DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_events_user_create_idempotency
  ON cash_events (user_id, create_idempotency_hash);

-- The current product has one consolidated cash ledger per user, not per broker
-- account. One opening balance per user/currency therefore establishes the
-- explicit baseline for that consolidated currency ledger.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_events_user_currency_opening
  ON cash_events (user_id, currency)
  WHERE event_type = 'OPENING_BALANCE';
