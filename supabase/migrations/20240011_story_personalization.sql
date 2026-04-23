-- Add supporting characters, author name, and closing message to story requests
ALTER TABLE story_requests
  ADD COLUMN IF NOT EXISTS supporting_characters TEXT,
  ADD COLUMN IF NOT EXISTS author_name            TEXT,
  ADD COLUMN IF NOT EXISTS closing_message        TEXT;
