-- Cross-tenant user identity: link same person across multiple brands
CREATE TABLE IF NOT EXISTS cross_tenant_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    identity_type VARCHAR(20) NOT NULL, -- 'line', 'phone', 'email'
    identity_key VARCHAR(255) NOT NULL, -- actual line_user_id, phone, or email
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id),
    UNIQUE(platform_user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_cti_platform_user ON cross_tenant_identities(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_cti_identity ON cross_tenant_identities(identity_type, identity_key);

-- Platform-level point ledger (tenant_id is NULL for platform-level entries)
CREATE TABLE IF NOT EXISTS platform_point_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_user_id UUID NOT NULL,
    entry_type VARCHAR(10) NOT NULL, -- 'credit', 'debit'
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(30) NOT NULL DEFAULT 'saversure_point',
    reference_type VARCHAR(50),  -- 'brand_exchange', 'platform_reward', 'platform_campaign'
    reference_id VARCHAR(100),
    source_tenant_id UUID REFERENCES tenants(id), -- which brand the points came from
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppl_user ON platform_point_ledger(platform_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppl_user_currency ON platform_point_ledger(platform_user_id, currency);

-- Exchange rate configuration per tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4) DEFAULT 1.0;
-- exchange_rate: how many saversure_points per 1 brand point (e.g. 1.0 = 1:1)
