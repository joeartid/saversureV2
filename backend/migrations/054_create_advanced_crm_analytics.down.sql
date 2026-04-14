DROP TABLE IF EXISTS crm_segment_exports;
DROP TABLE IF EXISTS analytics_campaign_roi;
DROP TABLE IF EXISTS analytics_product_affinities;
ALTER TABLE customer_rfm_snapshots
    DROP COLUMN IF EXISTS estimated_clv;
