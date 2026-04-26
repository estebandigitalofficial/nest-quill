-- Add email_type to delivery_logs for distinguishing story_ready vs story_failed emails.
-- Nullable with no default so all existing rows remain unaffected.
ALTER TABLE public.delivery_logs ADD COLUMN IF NOT EXISTS email_type TEXT;
