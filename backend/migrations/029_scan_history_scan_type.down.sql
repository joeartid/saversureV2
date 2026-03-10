DROP INDEX IF EXISTS idx_scan_history_scan_type;
DROP INDEX IF EXISTS idx_scan_history_code_id;
ALTER TABLE scan_history DROP COLUMN IF EXISTS scan_type;
