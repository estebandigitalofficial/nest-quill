-- ============================================================================
-- Content Library — centralized, tagged, reusable learning content
-- ============================================================================

-- Every quiz, flashcard set, study guide, etc. generated or curated lives here.
-- Learning tool APIs check this table first before generating new content.
CREATE TABLE IF NOT EXISTS content_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_type     text NOT NULL CHECK (tool_type IN ('quiz','flashcards','study-guide','explain','reading','spelling','math')),
  grade         smallint CHECK (grade BETWEEN 1 AND 12),
  subject       text,                               -- e.g. 'Math', 'Science', 'History'
  topic         text NOT NULL,                       -- the specific topic
  title         text NOT NULL,                       -- display title
  content       jsonb NOT NULL DEFAULT '{}',          -- the full generated content (questions, cards, etc.)
  tags          text[] NOT NULL DEFAULT '{}',         -- filterable tags
  source        text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai','scan','educator','admin','community')),
  quality       text NOT NULL DEFAULT 'auto' CHECK (quality IN ('auto','reviewed','approved','featured')),
  difficulty    text DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  standards     text[] NOT NULL DEFAULT '{}',         -- educational standards alignment codes
  use_count     int NOT NULL DEFAULT 0,              -- how many times served to users
  avg_score     numeric(5,2),                         -- average score when applicable
  total_attempts int NOT NULL DEFAULT 0,             -- total graded attempts
  total_correct  int NOT NULL DEFAULT 0,             -- total correct answers across attempts
  created_by    uuid REFERENCES auth.users(id),      -- null = system generated
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the cache-first lookup pattern
CREATE INDEX idx_content_library_lookup
  ON content_library (tool_type, grade, subject, is_active)
  WHERE is_active = true;

CREATE INDEX idx_content_library_topic
  ON content_library USING gin (to_tsvector('english', topic || ' ' || title));

CREATE INDEX idx_content_library_tags
  ON content_library USING gin (tags);

CREATE INDEX idx_content_library_quality
  ON content_library (quality, use_count DESC)
  WHERE is_active = true;

-- ============================================================================
-- Curriculum structure — courses, units, lessons
-- ============================================================================

-- A course is a full subject for a grade (e.g. "Grade 4 Math")
CREATE TABLE IF NOT EXISTS curriculum_courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade         smallint NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject       text NOT NULL,
  title         text NOT NULL,
  description   text,
  duration_weeks smallint DEFAULT 36,                 -- school year length
  standards     text[] NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade, subject)
);

-- A unit is a chapter/module within a course (e.g. "Fractions")
CREATE TABLE IF NOT EXISTS curriculum_units (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid NOT NULL REFERENCES curriculum_courses(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  week_start    smallint,                             -- which week this unit starts
  week_end      smallint,                             -- which week this unit ends
  sort_order    smallint NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_curriculum_units_course ON curriculum_units (course_id, sort_order);

-- A lesson is a single activity within a unit, linked to library content
CREATE TABLE IF NOT EXISTS curriculum_lessons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  content_id    uuid REFERENCES content_library(id) ON DELETE SET NULL,  -- linked library content
  title         text NOT NULL,
  tool_type     text NOT NULL,
  topic         text,
  sort_order    smallint NOT NULL DEFAULT 0,
  is_required   boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_curriculum_lessons_unit ON curriculum_lessons (unit_id, sort_order);

-- ============================================================================
-- Content usage tracking — who used what, scores, analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    uuid NOT NULL REFERENCES content_library(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id),
  classroom_id  uuid REFERENCES classrooms(id),
  tool_type     text NOT NULL,
  score         numeric(5,2),                         -- score if graded (0-100)
  completed     boolean NOT NULL DEFAULT false,
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_usage_content ON content_usage (content_id, created_at DESC);
CREATE INDEX idx_content_usage_user ON content_usage (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ============================================================================
-- RLS policies
-- ============================================================================

ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_usage ENABLE ROW LEVEL SECURITY;

-- Service role (admin client) has full access — no public read needed yet
CREATE POLICY "Service role full access" ON content_library FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON curriculum_courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON curriculum_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON curriculum_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON content_usage FOR ALL USING (true) WITH CHECK (true);
