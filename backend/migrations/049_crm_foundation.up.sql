-- Phase 1: CRM Foundation — Tags, Segments, RFM Snapshots
-- ใช้ร่วมกับข้อมูล V1 ที่ sync มาแล้วได้ทันที (ไม่ต้องดึง V1 เพิ่ม)

-- 1. Customer Tags
CREATE TABLE IF NOT EXISTS customer_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#6366f1',
    auto_rule   JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    tag_id      UUID NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
    assigned_by TEXT DEFAULT 'admin',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_cta_user ON customer_tag_assignments (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cta_tag  ON customer_tag_assignments (tenant_id, tag_id);

-- 2. Customer Segments
CREATE TABLE IF NOT EXISTS customer_segments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    rules         JSONB NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
    cached_count  INT DEFAULT 0,
    cached_at     TIMESTAMPTZ,
    created_by    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RFM Snapshots (pre-computed customer metrics)
CREATE TABLE IF NOT EXISTS customer_rfm_snapshots (
    tenant_id         UUID NOT NULL,
    user_id           UUID NOT NULL,
    last_scan_at      TIMESTAMPTZ,
    scan_count_30d    INT DEFAULT 0,
    scan_count_all    INT DEFAULT 0,
    points_earned_all INT DEFAULT 0,
    points_spent_all  INT DEFAULT 0,
    point_balance     INT DEFAULT 0,
    redeem_count_all  INT DEFAULT 0,
    last_redeem_at    TIMESTAMPTZ,
    rfm_score         TEXT,
    risk_level        TEXT DEFAULT 'normal',
    refreshed_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rfm_risk    ON customer_rfm_snapshots (tenant_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_rfm_refresh ON customer_rfm_snapshots (tenant_id, refreshed_at);

-- 4. Point ledger expiry tracking columns
ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS expiry_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS expiry_notify_sent BOOLEAN DEFAULT FALSE;

-- 5. Admin notes on customer
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes_updated_by UUID;
