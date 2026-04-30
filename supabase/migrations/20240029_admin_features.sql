-- ============================================================================
-- Migration: Admin Feature Expansion
-- Tables: ai_writer_config, email_drip_templates, email_drip_rules, image_library
-- Columns: story_requests.genre
-- Triggers: auto-populate image_library on scene completion
-- Functions: admin_revenue_by_period
-- ============================================================================

-- ── ai_writer_config ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_writer_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_writer_config ENABLE ROW LEVEL SECURITY;
-- Service role only — no public access
CREATE POLICY "ai_writer_config_service_only" ON ai_writer_config
  FOR ALL USING (false);

-- Seed with current hardcoded prompts
INSERT INTO ai_writer_config (key, value, description) VALUES
  ('story_role', 'You are a professional children''s book author. You write warm, age-appropriate stories for young children.', 'System role for the story generation prompt'),
  ('story_output_format', E'Your output must be valid JSON matching this exact structure:\n{\n  "title": "string — a short, memorable book title",\n  "subtitle": "string — an optional subtitle (can be empty string)",\n  "author_line": "A Nest & Quill Original",\n  "dedication": "string — a short dedication (only if provided, otherwise empty string)",\n  "synopsis": "string — 2-3 sentence description of the story",\n  "pages": [\n    {\n      "page": 1,\n      "text": "string — the story text for this page (2-4 sentences, age-appropriate)",\n      "image_description": "string — a detailed visual description for an illustrator (what to draw on this page)"\n    }\n  ]\n}', 'JSON output format specification for story generation'),
  ('story_page_rules', 'Write exactly {page_count} story pages', 'Page count rule (use {page_count} placeholder)'),
  ('story_language_rules', 'Keep language simple and age-appropriate for a {child_age}-year-old', 'Age-appropriate language rule (use {child_age} placeholder)'),
  ('story_sentence_rules', 'Each page should have 2-4 sentences maximum', 'Sentence count rule per page'),
  ('story_image_desc_rules', 'Image descriptions should be vivid, specific, and describe a single scene', 'Image description guidelines'),
  ('story_illustration_style_rule', 'The illustration style is {illustration_style} — reflect this in image description language', 'Illustration style instruction (use {illustration_style} placeholder)'),
  ('story_tone_rule', 'Tone: {tone_list}', 'Tone instruction (use {tone_list} placeholder)'),
  ('story_ending_rule', 'End the story with a satisfying, uplifting conclusion', 'Story ending instruction'),
  ('learning_mode_instructions', E'LEARNING MODE ACTIVE:\nThis story must naturally weave in educational content about "{learning_topic}" ({learning_subject}, grade {learning_grade}).\n- Introduce the concept early and reinforce it across multiple pages\n- Use age-appropriate vocabulary for a grade {learning_grade} student\n- Show the character applying or discovering the concept — don''t just state facts\n- The learning should feel like part of the story, not a lesson bolted on', 'Learning mode system prompt addition (use {learning_topic}, {learning_subject}, {learning_grade} placeholders)'),
  ('quiz_system_prompt', 'You are an educational assessment writer. Create 5 multiple-choice quiz questions based on the story and learning topic.', 'System role for quiz generation'),
  ('quiz_rules', E'Rules:\n- Write exactly 5 questions\n- Questions must be answerable from the story content\n- Mix comprehension questions (about story events) with concept questions (about {topic})\n- Keep language appropriate for grade {grade} (age {age_low}–{age_high})\n- Each question must have exactly 4 options\n- correct_index is 0-based (0 = first option, 3 = last option)\n- Explanations should be encouraging and educational', 'Quiz generation rules (use {topic}, {grade}, {age_low}, {age_high} placeholders)'),
  ('image_safety_suffix', 'Child-safe, no text, no words in image.', 'Safety suffix appended to all image generation prompts'),
  ('image_style_watercolor', 'soft watercolor illustration, gentle washes of color, children''s picture book style', 'DALL-E style hint for watercolor'),
  ('image_style_cartoon', 'bright cartoon illustration, bold outlines, vibrant colors, fun and playful children''s book style', 'DALL-E style hint for cartoon'),
  ('image_style_storybook', 'classic storybook illustration, warm and detailed, fairy-tale aesthetic, painted children''s book style', 'DALL-E style hint for storybook'),
  ('image_style_pencil_sketch', 'detailed pencil sketch illustration, hand-drawn, soft shading, charming children''s book style', 'DALL-E style hint for pencil_sketch'),
  ('image_style_digital_art', 'clean digital illustration, polished artwork, colorful, modern children''s book style', 'DALL-E style hint for digital_art')
ON CONFLICT (key) DO NOTHING;

-- ── email_drip_templates ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_drip_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence text NOT NULL,
  step int NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  subject text NOT NULL,
  body_html text NOT NULL,
  enabled bool NOT NULL DEFAULT true,
  trigger_condition text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sequence, step)
);

ALTER TABLE email_drip_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_drip_templates_service_only" ON email_drip_templates
  FOR ALL USING (false);

-- Seed story drip templates (steps 2, 4, 6)
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('story', 2, 2,
   '{child_name}''s story — here''s what you can do with it',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">Your story is ready to enjoy</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;"><strong style="color:#2E2E2E;">{child_name}''s story</strong> is waiting for you.</p>',
   'story_completed'),
  ('story', 4, 4,
   'Ideas for sharing {child_name}''s storybook',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">Make it a memory</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">{child_name}''s story is more than a one-time read.</p>',
   'story_completed'),
  ('story', 6, 6,
   'How did {child_name} like their story?',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">We''d love to hear from you</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">It means the world to us when families enjoy their stories. What did {child_name} think?</p>',
   'story_completed'),
  -- Signup drip templates (steps 1, 3, 5, 7)
  ('signup', 1, 1,
   'Your story is waiting to be written',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">Still thinking about it?</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Creating a personalized storybook takes about 5 minutes — and it''s free to try.</p>',
   'signup_no_story'),
  ('signup', 3, 3,
   'Here''s what you get when your story is done',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">A complete storybook — in minutes</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Here''s exactly what you get when your story finishes generating.</p>',
   'signup'),
  ('signup', 5, 5,
   'Every day, families are making memories with Nest & Quill',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">Real stories, real smiles</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Here''s how families are using their personalized stories.</p>',
   'signup'),
  ('signup', 7, 7,
   'Want more stories? Here are your options',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">Ready for more?</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">The free plan is a great start, but if you love your story and want more.</p>',
   'signup')
ON CONFLICT (sequence, step) DO NOTHING;

-- ── email_drip_rules ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_drip_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  template_id uuid REFERENCES email_drip_templates(id) ON DELETE SET NULL,
  conditions jsonb DEFAULT '{}',
  enabled bool NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_drip_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_drip_rules_service_only" ON email_drip_rules
  FOR ALL USING (false);

-- ── image_library ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS image_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES story_scenes(id) ON DELETE SET NULL,
  request_id uuid REFERENCES story_requests(id) ON DELETE CASCADE,
  storage_path text,
  storage_bucket text DEFAULT 'story-images',
  image_url text,
  tags text[] DEFAULT '{}',
  illustration_style text,
  theme text,
  child_age_range text,
  prompt_used text,
  revised_prompt text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE image_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "image_library_service_only" ON image_library
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_image_library_tags ON image_library USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_image_library_style ON image_library (illustration_style);
CREATE INDEX IF NOT EXISTS idx_image_library_created ON image_library (created_at DESC);

-- ── story_requests.genre ────────────────────────────────────────────────────

ALTER TABLE story_requests ADD COLUMN IF NOT EXISTS genre text;

-- ── Trigger: auto-populate image_library on scene completion ────────────────

CREATE OR REPLACE FUNCTION fn_image_library_auto_populate()
RETURNS trigger AS $$
BEGIN
  IF NEW.image_status = 'complete' AND (OLD.image_status IS DISTINCT FROM 'complete') THEN
    INSERT INTO image_library (scene_id, request_id, storage_path, storage_bucket, prompt_used, revised_prompt)
    VALUES (
      NEW.id,
      NEW.request_id,
      NEW.storage_path,
      COALESCE(NEW.storage_bucket, 'story-images'),
      NEW.image_prompt,
      NEW.image_revised_prompt
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_image_library_auto_populate ON story_scenes;
CREATE TRIGGER trg_image_library_auto_populate
  AFTER UPDATE ON story_scenes
  FOR EACH ROW
  EXECUTE FUNCTION fn_image_library_auto_populate();

-- ── Backfill: insert existing completed scene images into image_library ─────

INSERT INTO image_library (scene_id, request_id, storage_path, storage_bucket, prompt_used, revised_prompt, created_at)
SELECT
  ss.id,
  ss.request_id,
  ss.storage_path,
  COALESCE(ss.storage_bucket, 'story-images'),
  ss.image_prompt,
  ss.image_revised_prompt,
  ss.updated_at
FROM story_scenes ss
WHERE ss.image_status = 'complete'
  AND ss.storage_path IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM image_library il WHERE il.scene_id = ss.id);

-- Backfill metadata from story_requests
UPDATE image_library il
SET
  illustration_style = sr.illustration_style,
  theme = sr.story_theme,
  child_age_range = CASE
    WHEN sr.child_age <= 3 THEN '0-3'
    WHEN sr.child_age <= 5 THEN '4-5'
    WHEN sr.child_age <= 8 THEN '6-8'
    WHEN sr.child_age <= 12 THEN '9-12'
    ELSE '13+'
  END
FROM story_requests sr
WHERE il.request_id = sr.id
  AND il.illustration_style IS NULL;

-- Backfill genre on story_requests based on theme keyword matching
UPDATE story_requests SET genre = CASE
  WHEN lower(story_theme) ~ '(adventure|quest|journey|explore|pirate|treasure)' THEN 'adventure'
  WHEN lower(story_theme) ~ '(magic|wizard|fairy|dragon|unicorn|enchant|spell|witch)' THEN 'fantasy'
  WHEN lower(story_theme) ~ '(space|robot|alien|future|science|planet|rocket)' THEN 'sci-fi'
  WHEN lower(story_theme) ~ '(friend|share|kind|help|team|together)' THEN 'friendship'
  WHEN lower(story_theme) ~ '(animal|pet|dog|cat|horse|bunny|bear|zoo|farm)' THEN 'animals'
  WHEN lower(story_theme) ~ '(learn|school|math|read|abc|number|letter|science)' THEN 'educational'
  WHEN lower(story_theme) ~ '(princess|prince|king|queen|castle|knight)' THEN 'fairy-tale'
  WHEN lower(story_theme) ~ '(sport|soccer|baseball|swim|run|game|race)' THEN 'sports'
  WHEN lower(story_theme) ~ '(family|mom|dad|sister|brother|grandma|grandpa)' THEN 'family'
  WHEN lower(story_theme) ~ '(sleep|dream|bed|night|moon|star)' THEN 'bedtime'
  ELSE 'general'
END
WHERE genre IS NULL;

-- ── Reporting function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_revenue_by_period(from_date timestamptz, to_date timestamptz)
RETURNS TABLE (
  period date,
  plan_tier text,
  total_revenue_cents bigint,
  story_count bigint
) AS $$
  SELECT
    date_trunc('day', sr.paid_at)::date AS period,
    sr.plan_tier::text,
    COALESCE(SUM(sr.amount_paid_cents), 0) AS total_revenue_cents,
    COUNT(*) AS story_count
  FROM story_requests sr
  WHERE sr.paid_at IS NOT NULL
    AND sr.paid_at >= from_date
    AND sr.paid_at < to_date
  GROUP BY period, sr.plan_tier
  ORDER BY period, sr.plan_tier;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
