-- Saversure V2 pre-migration inventory
-- Read-only helper for checking whether the target DB is clean enough
-- to receive a fresh V1 -> V2 migration run.
-- Run this script with psql.

\echo '=== Core counts ==='
SELECT 'users_total' AS metric, COUNT(*)::bigint AS value FROM users
UNION ALL
SELECT 'users_with_v1_id', COUNT(*)::bigint FROM users WHERE v1_user_id IS NOT NULL
UNION ALL
SELECT 'users_without_v1_id', COUNT(*)::bigint FROM users WHERE v1_user_id IS NULL
UNION ALL
SELECT 'user_addresses_total', COUNT(*)::bigint FROM user_addresses
UNION ALL
SELECT 'products_total', COUNT(*)::bigint FROM products
UNION ALL
SELECT 'rewards_total', COUNT(*)::bigint FROM rewards
UNION ALL
SELECT 'scan_history_total', COUNT(*)::bigint FROM scan_history
UNION ALL
SELECT 'reward_reservations_total', COUNT(*)::bigint FROM reward_reservations
UNION ALL
SELECT 'point_ledger_total', COUNT(*)::bigint FROM point_ledger
UNION ALL
SELECT 'point_ledger_v1_migration', COUNT(*)::bigint FROM point_ledger WHERE reference_type = 'v1_migration'
UNION ALL
SELECT 'migration_jobs_total', COUNT(*)::bigint FROM migration_jobs
UNION ALL
SELECT 'migration_job_modules_total', COUNT(*)::bigint FROM migration_job_modules
UNION ALL
SELECT 'migration_job_errors_total', COUNT(*)::bigint FROM migration_job_errors
UNION ALL
SELECT 'migration_entity_maps_total', COUNT(*)::bigint FROM migration_entity_maps
UNION ALL
SELECT 'campaigns_total', COUNT(*)::bigint FROM campaigns
UNION ALL
SELECT 'page_configs_total', COUNT(*)::bigint FROM page_configs
UNION ALL
SELECT 'nav_menus_total', COUNT(*)::bigint FROM nav_menus
UNION ALL
SELECT 'popups_total', COUNT(*)::bigint FROM popups
ORDER BY metric;

\echo ''
\echo '=== Users without v1_user_id (likely bootstrap/local accounts) ==='
SELECT id, email, v1_user_id, created_at
FROM users
WHERE v1_user_id IS NULL
ORDER BY created_at;

\echo ''
\echo '=== Demo or CMS residues by tenant ==='
SELECT tenant_id, COUNT(*)::bigint AS product_count
FROM products
GROUP BY tenant_id
ORDER BY product_count DESC, tenant_id;

SELECT tenant_id, COUNT(*)::bigint AS reward_count
FROM rewards
GROUP BY tenant_id
ORDER BY reward_count DESC, tenant_id;

SELECT tenant_id, COUNT(*)::bigint AS scan_count
FROM scan_history
GROUP BY tenant_id
ORDER BY scan_count DESC, tenant_id;

SELECT tenant_id, COUNT(*)::bigint AS reservation_count
FROM reward_reservations
GROUP BY tenant_id
ORDER BY reservation_count DESC, tenant_id;

SELECT tenant_id, COUNT(*)::bigint AS page_config_count
FROM page_configs
GROUP BY tenant_id
ORDER BY page_config_count DESC, tenant_id;

SELECT tenant_id,
       menu_type,
       CASE
           WHEN jsonb_typeof(items) = 'array' THEN jsonb_array_length(items)
           ELSE NULL
       END AS item_count
FROM nav_menus
ORDER BY tenant_id, menu_type;

SELECT tenant_id, COUNT(*)::bigint AS popup_count
FROM popups
GROUP BY tenant_id
ORDER BY popup_count DESC, tenant_id;

\echo ''
\echo '=== Campaigns present in target DB ==='
SELECT id, tenant_id, name, status, created_at
FROM campaigns
ORDER BY created_at, id;

\echo ''
\echo '=== Quick decision guide ==='
\echo 'If users_with_v1_id > 0 or point_ledger_v1_migration > 0, restore baseline before Execute.'
\echo 'If campaigns/page_configs/nav_menus/popups are demo-only, exclude them from baseline.'
