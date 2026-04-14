CREATE TABLE IF NOT EXISTS analytics_customer_cohorts (
    tenant_id     UUID NOT NULL,
    cohort_month  TEXT NOT NULL,
    month_offset  INT NOT NULL,
    active_users  INT NOT NULL DEFAULT 0,
    total_users   INT NOT NULL DEFAULT 0,
    refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, cohort_month, month_offset)
);

CREATE INDEX IF NOT EXISTS idx_analytics_customer_cohorts_refreshed
    ON analytics_customer_cohorts (tenant_id, refreshed_at DESC);
