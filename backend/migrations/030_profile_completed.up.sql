-- Membership registration: users must complete their profile before scanning.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark existing users with phone + first_name as completed
UPDATE users SET profile_completed = true
WHERE phone IS NOT NULL AND phone != ''
  AND first_name IS NOT NULL AND first_name != '';

-- Prevent duplicate phone numbers within the same tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_phone_unique
ON users(tenant_id, phone) WHERE phone IS NOT NULL AND phone != '';
