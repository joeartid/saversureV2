-- Add shortcode column to tenants for brand-specific QR URL paths
-- e.g. qr.svsu.me/jh/A6FPZKTQL6 where "jh" is the shortcode for Jula'sHerb

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS shortcode VARCHAR(10);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_shortcode
    ON tenants(shortcode) WHERE shortcode IS NOT NULL;

-- Set default shortcode for existing Jula'sHerb tenant
UPDATE tenants SET shortcode = 'jh' WHERE slug = 'julasherb';
