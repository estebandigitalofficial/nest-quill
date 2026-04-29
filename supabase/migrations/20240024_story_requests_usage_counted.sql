-- Track whether books_generated has been incremented for a completed story.
-- Prevents double-counting on retry/requeue and concurrent status polls.
ALTER TABLE story_requests
  ADD COLUMN IF NOT EXISTS usage_counted boolean NOT NULL DEFAULT false;
