ALTER TABLE customer_rfm_snapshots
    ADD COLUMN IF NOT EXISTS estimated_clv NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS analytics_product_affinities (
    tenant_id           UUID NOT NULL,
    left_product_id     TEXT NOT NULL,
    left_product_name   TEXT NOT NULL,
    right_product_id    TEXT NOT NULL,
    right_product_name  TEXT NOT NULL,
    shared_users        INT NOT NULL DEFAULT 0,
    support_score       NUMERIC(8,4) NOT NULL DEFAULT 0,
    refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, left_product_id, right_product_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_product_affinities_refreshed
    ON analytics_product_affinities (tenant_id, refreshed_at DESC, shared_users DESC);

CREATE TABLE IF NOT EXISTS analytics_campaign_roi (
    tenant_id            UUID NOT NULL,
    campaign_id          UUID NOT NULL,
    campaign_name        TEXT NOT NULL,
    target_type          TEXT,
    recipient_count      INT NOT NULL DEFAULT 0,
    scans_before         INT NOT NULL DEFAULT 0,
    scans_after          INT NOT NULL DEFAULT 0,
    redeems_before       INT NOT NULL DEFAULT 0,
    redeems_after        INT NOT NULL DEFAULT 0,
    scan_uplift_pct      NUMERIC(10,2) NOT NULL DEFAULT 0,
    redeem_uplift_pct    NUMERIC(10,2) NOT NULL DEFAULT 0,
    measured_at          TIMESTAMPTZ,
    refreshed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_campaign_roi_refreshed
    ON analytics_campaign_roi (tenant_id, refreshed_at DESC, scan_uplift_pct DESC);

CREATE TABLE IF NOT EXISTS crm_segment_exports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    segment_id      UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    segment_name    TEXT NOT NULL,
    segment_rules   JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'queued',
    total_rows      INT NOT NULL DEFAULT 0,
    object_key      TEXT,
    file_url        TEXT,
    requested_by    UUID,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_segment_exports_queue
    ON crm_segment_exports (tenant_id, status, created_at DESC);
