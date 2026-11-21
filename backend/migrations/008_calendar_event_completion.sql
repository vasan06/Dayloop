ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS calendar_events_user_completed_idx
ON calendar_events (user_id, completed_at);
