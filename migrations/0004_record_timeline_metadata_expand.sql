-- R2.2A expand-only migration.
--
-- This migration deliberately does NOT advance schema_metadata. The existing
-- schema-v3 Worker/API does not require these columns and remains fully
-- compatible after the expansion. R2.2B will activate a new schema/API
-- contract only after this additive storage has been deployed and verified.
--
-- All fields are nullable so every existing BUY/SELL/DIV row remains valid.
-- No default values are used: unknown metadata must remain unknown.

ALTER TABLE records ADD COLUMN currency TEXT;
ALTER TABLE records ADD COLUMN executed_at TEXT;
ALTER TABLE records ADD COLUMN execution_sequence TEXT;
ALTER TABLE records ADD COLUMN event_source TEXT;
