-- Tracks which drip emails have been sent, preventing duplicates
CREATE TABLE IF NOT EXISTS drip_email_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT        NOT NULL,
  sequence        TEXT        NOT NULL,  -- 'story' | 'signup'
  step            INTEGER     NOT NULL,  -- day number (2, 4, 6 for story; 1, 3, 5, 7 for signup)
  reference_id    TEXT        NOT NULL,  -- story_request.id or profile.id
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipient_email, sequence, step, reference_id)
);

CREATE INDEX IF NOT EXISTS drip_email_log_email_seq_step
  ON drip_email_log (recipient_email, sequence, step);
