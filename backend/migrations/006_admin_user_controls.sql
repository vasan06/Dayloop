ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_disabled BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users(last_seen_at DESC);
