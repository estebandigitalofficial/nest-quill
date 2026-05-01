-- ============================================================================
-- Migration: App Settings
-- Table: app_settings
-- Purpose: Centralized key-value store for product configuration.
--          All values are JSONB so booleans, numbers, and strings can
--          be stored without a separate column type per setting.
--          Reads are done via service role only — no public access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key           text PRIMARY KEY,
  value         jsonb NOT NULL,
  category      text NOT NULL,
  label         text NOT NULL,
  description   text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so this effectively blocks all non-service access.
CREATE POLICY "app_settings_service_only" ON app_settings
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings (category);

-- ── Seed ────────────────────────────────────────────────────────────────────

INSERT INTO app_settings (key, value, category, label, description) VALUES

  -- Plans & Limits
  ('guest_story_limit',
   '1',
   'plans',
   'Guest story limit',
   'Maximum number of stories a guest can request before being prompted to create an account'),

  ('free_user_story_limit',
   '2',
   'plans',
   'Free user story limit',
   'Maximum stories a free-tier account can generate per month'),

  -- Feature Flags
  ('scan_homework_enabled',
   'true',
   'flags',
   'Scan Homework',
   'Allow users to upload and scan homework documents for the learning tools'),

  ('classroom_enabled',
   'true',
   'flags',
   'Classroom',
   'Show the Classroom section and all educator-facing flows'),

  ('trivia_enabled',
   'true',
   'flags',
   'Trivia Mode',
   'Enable trivia and quiz mode on completed stories'),

  ('publishing_requests_enabled',
   'false',
   'flags',
   'Publishing Requests',
   'Enable the user-facing publishing request form and workflow'),

  ('pdf_download_enabled',
   'false',
   'flags',
   'PDF Download',
   'Allow users to download their stories as a PDF'),

  ('maintenance_mode_enabled',
   'false',
   'flags',
   'Maintenance Mode',
   'Take the site offline and display a maintenance message to all visitors'),

  -- Learning Tool Settings
  ('think_first_enabled',
   'true',
   'learning',
   'Think First',
   'Default state for Think First prompting mode in learning tools'),

  ('teach_back_enabled',
   'true',
   'learning',
   'Teach Back',
   'Default state for Teach Back exercise mode in learning tools'),

  ('learning_nudges_enabled',
   'true',
   'learning',
   'Nudges',
   'Enable in-session encouragement nudges during learning tool sessions'),

  ('spelling_sentence_mode_default',
   'false',
   'learning',
   'Spelling sentence mode default',
   'Whether spelling sentence generation mode is on by default'),

  -- Safety / Guardrails
  ('strict_school_safe_mode',
   'true',
   'safety',
   'Strict school-safe mode',
   'Enforce conservative content filtering across all AI tools'),

  ('political_clarification_enabled',
   'true',
   'safety',
   'Political clarification',
   'Show a clarification prompt when politically sensitive topics are detected in user input'),

  ('max_pasted_text_length',
   '5000',
   'safety',
   'Max pasted text length',
   'Maximum number of characters a user can paste into any tool input'),

  ('max_image_upload_mb',
   '5',
   'safety',
   'Max image upload size (MB)',
   'Maximum file size in megabytes for user image uploads'),

  -- Admin Dashboard Settings
  ('stuck_story_threshold_minutes',
   '10',
   'dashboard',
   'Stuck-story threshold (minutes)',
   'Minutes a story can remain in a generating state before being flagged as stuck on the dashboard')

ON CONFLICT (key) DO NOTHING;
