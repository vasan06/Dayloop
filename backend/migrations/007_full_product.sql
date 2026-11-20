ALTER TABLE users
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE habits
    ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS target_type VARCHAR(8) NOT NULL DEFAULT 'at_least',
    ADD COLUMN IF NOT EXISTS reminder_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS frequency_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS color VARCHAR(32),
    ADD COLUMN IF NOT EXISTS daily_note_required BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habits_target_type_check'
    ) THEN
        ALTER TABLE habits
            ADD CONSTRAINT habits_target_type_check
            CHECK (target_type IN ('at_least','at_most'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS streak_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('started','continued','failed','skipped','missed','resumed')),
    event_date DATE NOT NULL,
    streak_length INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (habit_id, event_date)
);
CREATE INDEX IF NOT EXISTS streak_events_user_date_idx
    ON streak_events(user_id, event_date DESC);

CREATE TABLE IF NOT EXISTS task_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, user_id)
);

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS click_path TEXT;
CREATE INDEX IF NOT EXISTS notifications_user_center_idx
    ON notifications(user_id, dismissed_at, read_at, created_at DESC);
