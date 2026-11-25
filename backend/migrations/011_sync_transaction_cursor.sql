-- Existing rows keep their original order in transaction 0. A fresh cursor
-- replays them once, including any rows an older sequence-only cursor missed.
ALTER TABLE sync_change_log
    ADD COLUMN IF NOT EXISTS transaction_id xid8 NOT NULL DEFAULT '0'::xid8;
ALTER TABLE sync_change_log
    ALTER COLUMN transaction_id SET DEFAULT pg_current_xact_id();
CREATE INDEX IF NOT EXISTS sync_change_log_owner_transaction_idx
    ON sync_change_log(user_id, transaction_id, sequence);
