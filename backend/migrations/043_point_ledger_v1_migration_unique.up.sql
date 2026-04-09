-- Prevent duplicate v1_migration ledger entries when migrator is run more than once
-- (or when 2 migration jobs run concurrently — the in-memory dedup map in
-- backend/internal/migrationjob/runners.go is not thread-safe across jobs).
--
-- Partial unique index — applies only to v1_migration rows.
-- Other reference_types (scan/redemption/lucky_draw/...) are unaffected because
-- they legitimately allow multiple rows per (user, reference_id) pair.
--
-- After this migration, a duplicate INSERT INTO point_ledger with
-- reference_type='v1_migration' and the same (tenant_id, user_id, reference_id)
-- will fail with a unique violation. The migrator code is updated to use
-- ON CONFLICT DO NOTHING to handle this gracefully.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_ledger_v1_migration_unique
    ON point_ledger (tenant_id, user_id, reference_id)
    WHERE reference_type = 'v1_migration';
