-- Durable, per-user change feed for Android SQLite synchronization.
-- Captures writes from all existing PC API endpoints without rewriting their services.
CREATE TABLE IF NOT EXISTS sync_change_log (
    sequence BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    entity TEXT NOT NULL,
    record_key TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('upsert','delete')),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_change_log_owner_sequence_idx
    ON sync_change_log(user_id, sequence);

CREATE OR REPLACE FUNCTION dayloop_record_sync_change() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    content JSONB;
    owner_id UUID;
    entity_key TEXT;
    relation_key TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        content := to_jsonb(OLD);
    ELSE
        content := to_jsonb(NEW);
    END IF;

    -- User heartbeat writes should not force a full profile sync.
    IF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' AND
       to_jsonb(NEW) - 'last_seen_at' = to_jsonb(OLD) - 'last_seen_at' THEN
        RETURN NULL;
    END IF;

    IF TG_TABLE_NAME = 'users' THEN
        owner_id := (content->>'id')::uuid;
    ELSIF content ? 'user_id' THEN
        owner_id := (content->>'user_id')::uuid;
    ELSIF TG_TABLE_NAME IN ('habit_entries','habit_schedules') THEN
        SELECT user_id INTO owner_id FROM habits WHERE id = (content->>'habit_id')::uuid;
    ELSIF TG_TABLE_NAME = 'note_blocks' THEN
        SELECT user_id INTO owner_id FROM note_pages WHERE id = (content->>'page_id')::uuid;
    ELSIF TG_TABLE_NAME = 'task_dependencies' THEN
        SELECT user_id INTO owner_id FROM tasks WHERE id = (content->>'task_id')::uuid;
    ELSIF TG_TABLE_NAME = 'budget_category_limits' THEN
        SELECT user_id INTO owner_id FROM budgets WHERE id = (content->>'budget_id')::uuid;
    ELSIF TG_TABLE_NAME = 'savings_contributions' THEN
        SELECT user_id INTO owner_id FROM savings_goals WHERE id = (content->>'savings_goal_id')::uuid;
    ELSIF TG_TABLE_NAME = 'goal_milestones' THEN
        SELECT user_id INTO owner_id FROM goals WHERE id = (content->>'goal_id')::uuid;
    ELSIF TG_TABLE_NAME = 'tracker_entries' THEN
        SELECT user_id INTO owner_id FROM tracker_definitions WHERE id = (content->>'tracker_id')::uuid;
    ELSIF TG_TABLE_NAME = 'notification_deliveries' THEN
        SELECT user_id INTO owner_id FROM notification_jobs WHERE id = (content->>'job_id')::uuid;
    END IF;

    -- A cascading parent deletion is recorded by the parent's own trigger.
    IF owner_id IS NULL THEN RETURN NULL; END IF;

    entity_key := COALESCE(
        content->>'id',
        (content->>'task_id') || ':' || (content->>'depends_on_task_id'),
        (content->>'budget_id') || ':' || (content->>'category_id'),
        (content->>'habit_id') || ':' || (content->>'entry_date'),
        (content->>'notification_id') || ':' || (content->>'job_id'),
        md5(content::text)
    );
    INSERT INTO sync_change_log (user_id, entity, record_key, action)
    VALUES (owner_id, TG_TABLE_NAME, entity_key,
            CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'upsert' END);
    RETURN NULL;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
      'users','projects','tasks','task_dependencies','note_pages','note_blocks',
      'habits','habit_schedules','habit_entries','finance_categories','finance_transactions',
      'budgets','budget_category_limits','savings_goals','savings_contributions',
      'goals','goal_milestones','tracker_definitions','tracker_entries','calendar_events',
      'notifications','notification_jobs','notification_deliveries','attachments','streak_events','task_notes'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS dayloop_sync_change ON %I', table_name);
        EXECUTE format(
            'CREATE TRIGGER dayloop_sync_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION dayloop_record_sync_change()',
            table_name
        );
    END LOOP;
END
$$;
