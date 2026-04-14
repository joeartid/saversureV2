CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    name                TEXT NOT NULL,
    message_type        TEXT NOT NULL DEFAULT 'text',
    message_payload     JSONB NOT NULL,
    target_type         TEXT NOT NULL DEFAULT 'segment',
    target_value        TEXT,
    recipient_summary   JSONB NOT NULL DEFAULT '{}'::jsonb,
    confirmation_phrase TEXT NOT NULL,
    confirmation_text   TEXT,
    scheduled_at        TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'draft',
    total_matched       INT NOT NULL DEFAULT 0,
    line_linked_count   INT NOT NULL DEFAULT 0,
    estimated_batches   INT NOT NULL DEFAULT 0,
    sent_count          INT NOT NULL DEFAULT 0,
    failed_count        INT NOT NULL DEFAULT 0,
    requires_extra_ack  BOOLEAN NOT NULL DEFAULT FALSE,
    high_risk_ack       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by          UUID,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    last_error          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status_schedule
    ON broadcast_campaigns (tenant_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created_at
    ON broadcast_campaigns (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS broadcast_delivery_logs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    tenant_id             UUID NOT NULL,
    user_id               UUID,
    line_user_id          TEXT,
    status                TEXT NOT NULL DEFAULT 'sent',
    error_message         TEXT,
    sent_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_delivery_logs_campaign
    ON broadcast_delivery_logs (broadcast_campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_delivery_logs_tenant_status
    ON broadcast_delivery_logs (tenant_id, status, created_at DESC);
