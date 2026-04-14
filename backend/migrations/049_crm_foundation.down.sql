ALTER TABLE users DROP COLUMN IF EXISTS admin_notes_updated_by;
ALTER TABLE users DROP COLUMN IF EXISTS admin_notes_updated_at;
ALTER TABLE users DROP COLUMN IF EXISTS admin_notes;

ALTER TABLE point_ledger DROP COLUMN IF EXISTS expiry_notify_sent;
ALTER TABLE point_ledger DROP COLUMN IF EXISTS expiry_processed;

DROP TABLE IF EXISTS customer_rfm_snapshots;
DROP TABLE IF EXISTS customer_segments;
DROP TABLE IF EXISTS customer_tag_assignments;
DROP TABLE IF EXISTS customer_tags;
