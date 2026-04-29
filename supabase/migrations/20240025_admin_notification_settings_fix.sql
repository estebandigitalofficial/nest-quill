-- Fix admin_notification_settings constraints that may block new notification types.
-- The original table was created with CREATE TABLE IF NOT EXISTS, so if it already
-- existed it may have: (a) a CHECK constraint limiting notification_type values, or
-- (b) no UNIQUE constraint on (admin_user_id, notification_type), which causes
-- INSERT ... ON CONFLICT to fail for rows that don't yet exist.

-- 1. Drop any CHECK constraints on notification_type (they prevent new types).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'admin_notification_settings'
      AND con.contype = 'c'
  LOOP
    EXECUTE 'ALTER TABLE admin_notification_settings DROP CONSTRAINT ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped CHECK constraint: %', r.conname;
  END LOOP;
END $$;

-- 2. Add UNIQUE constraint if missing (required for upsert ON CONFLICT).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'admin_notification_settings'
      AND con.contype = 'u'
  ) THEN
    ALTER TABLE admin_notification_settings
      ADD CONSTRAINT admin_notification_settings_user_type_unique
      UNIQUE (admin_user_id, notification_type);
    RAISE NOTICE 'Added UNIQUE constraint on (admin_user_id, notification_type)';
  END IF;
END $$;
