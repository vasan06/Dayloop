CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color VARCHAR(32) NOT NULL DEFAULT 'persimmon',
    status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed')),
    start_date DATE,
    due_date DATE,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, user_id)
);
CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID,
    parent_task_id UUID,
    title VARCHAR(240) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(24) NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('inbox','not_started','in_progress','waiting','completed','cancelled')),
    priority VARCHAR(16) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low','normal','high','urgent')),
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    start_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id),
    FOREIGN KEY (parent_task_id, user_id) REFERENCES tasks(id, user_id)
);
CREATE INDEX IF NOT EXISTS tasks_user_status_due_idx ON tasks(user_id, status, due_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_project_position_idx ON tasks(project_id, position) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks(parent_task_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id UUID NOT NULL,
    depends_on_task_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id <> depends_on_task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_page_id UUID,
    title VARCHAR(240) NOT NULL DEFAULT 'Untitled',
    icon VARCHAR(32),
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    FOREIGN KEY (parent_page_id, user_id) REFERENCES note_pages(id, user_id)
);
CREATE INDEX IF NOT EXISTS note_pages_user_parent_idx ON note_pages(user_id, parent_page_id, position);

CREATE TABLE IF NOT EXISTS note_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES note_pages(id) ON DELETE CASCADE,
    parent_block_id UUID REFERENCES note_blocks(id) ON DELETE CASCADE,
    block_type VARCHAR(32) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS note_blocks_page_position_idx ON note_blocks(page_id, position);

CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    habit_type VARCHAR(16) NOT NULL DEFAULT 'positive' CHECK (habit_type IN ('positive','negative')),
    measurement_type VARCHAR(16) NOT NULL DEFAULT 'boolean' CHECK (measurement_type IN ('boolean','quantity','duration')),
    target_value NUMERIC(14,3),
    unit VARCHAR(32),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS habit_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    schedule_type VARCHAR(16) NOT NULL CHECK (schedule_type IN ('daily','weekly','custom')),
    schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE
);
CREATE TABLE IF NOT EXISTS habit_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('completed','skipped','missed','failed')),
    value NUMERIC(14,3),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (habit_id, entry_date)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
