DROP INDEX IF EXISTS idx_tenants_shortcode;
ALTER TABLE tenants DROP COLUMN IF EXISTS shortcode;
