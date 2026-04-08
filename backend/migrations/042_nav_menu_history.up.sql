-- Version history for nav menus (rollback support, mirrors page_config_history)

-- 1. Add version field to nav_menus
ALTER TABLE nav_menus ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 2. Create history snapshot table
CREATE TABLE IF NOT EXISTS nav_menu_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nav_menu_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    menu_type VARCHAR(30) NOT NULL,
    version INT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nav_menu_history_lookup
    ON nav_menu_history(tenant_id, menu_type, version DESC);
