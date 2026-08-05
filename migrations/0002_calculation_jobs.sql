-- PR-07: durable, tenant-scoped calculation jobs and idempotent trigger identity.

CREATE TABLE IF NOT EXISTS calculation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE CHECK (length(public_id) = 26),
  user_id TEXT NOT NULL,
  idempotency_hash TEXT CHECK (idempotency_hash IS NULL OR length(idempotency_hash) = 64),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  benchmark TEXT NOT NULL,
  github_run_id TEXT,
  github_run_attempt INTEGER NOT NULL DEFAULT 0 CHECK (github_run_attempt >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, idempotency_hash)
);

CREATE INDEX IF NOT EXISTS idx_calculation_jobs_user_created
  ON calculation_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculation_jobs_status_created
  ON calculation_jobs (status, created_at DESC);

UPDATE schema_metadata
SET schema_version = 2,
    release_version = '4.07',
    applied_at = CURRENT_TIMESTAMP
WHERE id = 1 AND schema_version = 1;
