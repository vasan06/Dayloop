CREATE TABLE IF NOT EXISTS finance_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    category_type VARCHAR(12) NOT NULL CHECK (category_type IN ('income','expense')),
    color VARCHAR(24) NOT NULL DEFAULT 'persimmon',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id,user_id),
    UNIQUE (user_id,name,category_type)
);
CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID,
    transaction_type VARCHAR(12) NOT NULL CHECK (transaction_type IN ('income','expense')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description VARCHAR(240) NOT NULL DEFAULT '',
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id,user_id) REFERENCES finance_categories(id,user_id)
);
CREATE INDEX IF NOT EXISTS finance_transactions_user_date_idx
    ON finance_transactions(user_id,transaction_date DESC) WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    period_type VARCHAR(16) NOT NULL DEFAULT 'monthly'
        CHECK (period_type IN ('weekly','monthly','custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_limit NUMERIC(14,2) NOT NULL CHECK (total_limit > 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (period_end >= period_start),
    UNIQUE (id,user_id)
);
CREATE TABLE IF NOT EXISTS budget_category_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES finance_categories(id) ON DELETE CASCADE,
    limit_amount NUMERIC(14,2) NOT NULL CHECK (limit_amount > 0),
    UNIQUE (budget_id,category_id)
);
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    target_date DATE,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS savings_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    savings_goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description VARCHAR(240) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    goal_type VARCHAR(16) NOT NULL DEFAULT 'personal' CHECK (goal_type IN ('personal','learning','health','finance','career')),
    target_value NUMERIC(14,3),
    current_value NUMERIC(14,3) NOT NULL DEFAULT 0,
    unit VARCHAR(32),
    start_date DATE,
    target_date DATE,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    target_date DATE,
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tracker_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    metric_type VARCHAR(16) NOT NULL CHECK (metric_type IN ('number','duration','boolean')),
    unit VARCHAR(32),
    target_value NUMERIC(14,3),
    frequency VARCHAR(16) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly')),
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id,user_id)
);
CREATE TABLE IF NOT EXISTS tracker_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracker_id UUID NOT NULL REFERENCES tracker_definitions(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    numeric_value NUMERIC(14,3),
    text_value TEXT,
    notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS tracker_entries_recorded_idx ON tracker_entries(tracker_id,recorded_at DESC);

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    recurrence_rule TEXT,
    source_type VARCHAR(24),
    source_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS calendar_events_user_start_idx ON calendar_events(user_id,start_at);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(32),
    source_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
