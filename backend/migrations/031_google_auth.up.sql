ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture_url TEXT;

CREATE INDEX IF NOT EXISTS idx_users_google_sub
ON users(google_sub)
WHERE google_sub IS NOT NULL;
