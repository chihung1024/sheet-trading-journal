-- PR-05 baseline: document the production-compatible D1 schema without
-- destructive changes. CREATE IF NOT EXISTS makes this safe for both a new
-- database and the existing production database.

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  txn_date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('BUY', 'SELL', 'DIV')),
  qty REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  tag TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_records_user_txn_date_created
  ON records (user_id, txn_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  json_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id_id
  ON portfolio_snapshots (user_id, id DESC);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  benchmark TEXT NOT NULL DEFAULT 'SPY',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL,
  release_version TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_metadata (id, schema_version, release_version, applied_at)
VALUES (1, 1, '4.05', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  schema_version = excluded.schema_version,
  release_version = excluded.release_version,
  applied_at = CURRENT_TIMESTAMP;
