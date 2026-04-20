-- Add story_tone and story_moral to story_requests
-- story_tone: array of mood adjectives (e.g. ['adventurous', 'magical'])
-- story_moral: optional lesson to weave into the story

ALTER TABLE story_requests
  ADD COLUMN IF NOT EXISTS story_tone  TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS story_moral TEXT;
