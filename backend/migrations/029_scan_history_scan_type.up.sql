-- Scan type: success = ได้แต้ม, duplicate_self = สแกนซ้ำตัวเอง, duplicate_other = สแกนซ้ำคนอื่น
ALTER TABLE scan_history
  ADD COLUMN IF NOT EXISTS scan_type VARCHAR(30) NOT NULL DEFAULT 'success'
  CHECK (scan_type IN ('success', 'duplicate_self', 'duplicate_other'));

CREATE INDEX IF NOT EXISTS idx_scan_history_code_id ON scan_history(code_id) WHERE code_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(tenant_id, scan_type, scanned_at DESC);
