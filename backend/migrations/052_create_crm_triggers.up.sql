CREATE TABLE IF NOT EXISTS crm_triggers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    delay_hours     INT NOT NULL DEFAULT 0,
    action_type     TEXT NOT NULL,
    action_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_triggers_tenant_active
    ON crm_triggers (tenant_id, active, event_type);

CREATE TABLE IF NOT EXISTS crm_trigger_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id   UUID NOT NULL REFERENCES crm_triggers(id) ON DELETE CASCADE,
    tenant_id    UUID NOT NULL,
    user_id      UUID NOT NULL,
    fired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status       TEXT NOT NULL DEFAULT 'sent',
    detail       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_trigger_logs_user
    ON crm_trigger_logs (tenant_id, user_id, trigger_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_trigger_logs_trigger_user
    ON crm_trigger_logs (trigger_id, user_id);
