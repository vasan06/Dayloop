CREATE TABLE IF NOT EXISTS notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(32),
    source_id UUID,
    channel VARCHAR(12) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','push')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_jobs_due_idx
    ON notification_jobs(status,scheduled_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
    provider_message_id TEXT,
    status VARCHAR(16) NOT NULL,
    delivered_at TIMESTAMPTZ,
    error_code TEXT
);
