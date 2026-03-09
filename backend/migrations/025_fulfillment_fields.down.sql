DROP INDEX IF EXISTS idx_reservations_fulfillment;
ALTER TABLE reward_reservations
    DROP COLUMN IF EXISTS fulfillment_status,
    DROP COLUMN IF EXISTS tracking_number,
    DROP COLUMN IF EXISTS shipped_at,
    DROP COLUMN IF EXISTS delivered_at;
