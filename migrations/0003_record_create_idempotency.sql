-- Product Functionality Review NOW-1A: durable tenant-scoped idempotency for record creation.
-- Existing rows remain compatible because both new columns are nullable.

ALTER TABLE records ADD COLUMN create_idempotency_hash TEXT;
ALTER TABLE records ADD COLUMN create_payload_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_user_create_idempotency
  ON records (user_id, create_idempotency_hash);

UPDATE schema_metadata
SET schema_version = 3,
    release_version = '4.08',
    applied_at = CURRENT_TIMESTAMP
WHERE id = 1 AND schema_version = 2;
