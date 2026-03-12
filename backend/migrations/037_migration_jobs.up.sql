CREATE TABLE IF NOT EXISTS migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('dry_run', 'execute')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    source_system VARCHAR(30) NOT NULL DEFAULT 'v1_backup',
    selected_modules TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    source_config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_module VARCHAR(50),
    current_step VARCHAR(100),
    total_items BIGINT NOT NULL DEFAULT 0,
    processed_items BIGINT NOT NULL DEFAULT 0,
    success_count BIGINT NOT NULL DEFAULT 0,
    failed_count BIGINT NOT NULL DEFAULT 0,
    warning_count BIGINT NOT NULL DEFAULT 0,
    percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant
    ON migration_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status
    ON migration_jobs(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS migration_job_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
    module_name VARCHAR(50) NOT NULL,
    dependency_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    current_step VARCHAR(100),
    estimated_count BIGINT NOT NULL DEFAULT 0,
    processed_count BIGINT NOT NULL DEFAULT 0,
    success_count BIGINT NOT NULL DEFAULT 0,
    failed_count BIGINT NOT NULL DEFAULT 0,
    warning_count BIGINT NOT NULL DEFAULT 0,
    percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(job_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_migration_job_modules_job
    ON migration_job_modules(job_id, dependency_order);

CREATE TABLE IF NOT EXISTS migration_job_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
    module_name VARCHAR(50) NOT NULL,
    source_entity_type VARCHAR(50),
    source_id VARCHAR(100),
    message TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_job_errors_job
    ON migration_job_errors(job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS migration_entity_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    entity_type VARCHAR(50) NOT NULL,
    source_system VARCHAR(30) NOT NULL DEFAULT 'v1',
    source_id VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    latest_job_id UUID REFERENCES migration_jobs(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(tenant_id, entity_type, source_system, source_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_entity_maps_target
    ON migration_entity_maps(tenant_id, entity_type, target_id);
