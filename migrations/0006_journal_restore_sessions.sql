-- R3.1B: additive tenant-safe journal restore session guard.
--
-- This table does not change the canonical schema compatibility version. The
-- existing schema-v3 Worker remains compatible; only the separately reviewed
-- journal-restore entry route depends on this additive table. Deployment must
-- apply migrations before activating that route.
--
-- Live journal rows are never staged here. A restore session is only a durable
-- idempotency/concurrency guard around one atomic D1 batch that writes records
-- and cash_events together.

CREATE TABLE IF NOT EXISTS journal_restore_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  idempotency_hash TEXT NOT NULL
    CHECK (length(idempotency_hash) = 64),
  payload_hash TEXT NOT NULL
    CHECK (length(payload_hash) = 64),
  backup_schema_version INTEGER NOT NULL
    CHECK (backup_schema_version = 1),
  expected_record_count INTEGER NOT NULL
    CHECK (expected_record_count >= 0),
  expected_cash_event_count INTEGER NOT NULL
    CHECK (expected_cash_event_count >= 0),
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'completed')),
  -- The final batch statement deliberately assigns 0 when live row counts do
  -- not equal the validated backup counts. This CHECK then fails and causes
  -- D1 to roll back the entire batch, including the session row and all data.
  completion_guard INTEGER NOT NULL DEFAULT 1
    CHECK (completion_guard = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_restore_user_idempotency
  ON journal_restore_sessions (user_id, idempotency_hash);

CREATE INDEX IF NOT EXISTS idx_journal_restore_user_created
  ON journal_restore_sessions (user_id, created_at DESC, id DESC);
