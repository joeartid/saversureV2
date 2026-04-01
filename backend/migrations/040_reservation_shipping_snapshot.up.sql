-- Add shipping snapshot fields to reward_reservations
-- These fields store a snapshot of the address at time of redemption
-- so that if the user updates/deletes their address later, the order record is preserved.
ALTER TABLE reward_reservations
    ADD COLUMN IF NOT EXISTS delivery_type        VARCHAR(30),
    ADD COLUMN IF NOT EXISTS recipient_name       VARCHAR(200),
    ADD COLUMN IF NOT EXISTS recipient_phone      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT,
    ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT,
    ADD COLUMN IF NOT EXISTS shipping_district    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_sub_district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_province    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(10);
