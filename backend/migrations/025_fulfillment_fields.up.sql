-- Add fulfillment tracking fields to reward_reservations
ALTER TABLE reward_reservations
    ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservations_fulfillment
    ON reward_reservations(tenant_id, fulfillment_status)
    WHERE status = 'CONFIRMED';
