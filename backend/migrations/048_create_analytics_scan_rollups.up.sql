CREATE TABLE IF NOT EXISTS analytics_scan_rollups (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bucket_type VARCHAR(20) NOT NULL CHECK (bucket_type IN ('day', 'week', 'month', 'all_time')),
    bucket_key VARCHAR(32) NOT NULL,
    bucket_start TIMESTAMPTZ,
    total_scans BIGINT NOT NULL DEFAULT 0,
    success_scans BIGINT NOT NULL DEFAULT 0,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, bucket_type, bucket_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_scan_rollups_lookup
    ON analytics_scan_rollups(tenant_id, bucket_type, bucket_start DESC);
