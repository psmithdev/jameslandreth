-- Soft delete support for artifacts
-- Deleted rows keep their data and can be recovered by setting deleted_at back to NULL.
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
