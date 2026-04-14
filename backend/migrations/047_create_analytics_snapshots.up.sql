CREATE TABLE IF NOT EXISTS analytics_snapshots (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_key VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, snapshot_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_refreshed_at
    ON analytics_snapshots(refreshed_at DESC);
