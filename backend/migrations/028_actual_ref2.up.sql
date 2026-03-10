-- โรงงานรายงาน ref2 จริงต้น-ท้ายม้วน หลังพิมพ์เสร็จ
ALTER TABLE rolls ADD COLUMN IF NOT EXISTS actual_ref2_start BIGINT;
ALTER TABLE rolls ADD COLUMN IF NOT EXISTS actual_ref2_end   BIGINT;
ALTER TABLE rolls ADD COLUMN IF NOT EXISTS waste_count       INT NOT NULL DEFAULT 0;
ALTER TABLE rolls ADD COLUMN IF NOT EXISTS ref2_reported_at  TIMESTAMPTZ;
ALTER TABLE rolls ADD COLUMN IF NOT EXISTS ref2_reported_by  UUID REFERENCES users(id);
