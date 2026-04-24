-- ============================================================
-- GAMIFICATION — Avatar, XP, Levels, Badges
-- ============================================================

-- ── STUDENT PROFILES ─────────────────────────────────────────
CREATE TABLE public.student_profiles (
  student_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL DEFAULT 'Explorer' CHECK (char_length(display_name) BETWEEN 1 AND 30),
  avatar_emoji    TEXT NOT NULL DEFAULT '🦊',
  avatar_color    TEXT NOT NULL DEFAULT 'indigo',
  xp              INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level           SMALLINT NOT NULL DEFAULT 1,
  coins           INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  streak_days     SMALLINT NOT NULL DEFAULT 0,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── XP LOG ───────────────────────────────────────────────────
CREATE TABLE public.xp_log (
  id            BIGSERIAL PRIMARY KEY,
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        SMALLINT NOT NULL,
  reason        TEXT NOT NULL,   -- 'assignment_complete', 'perfect_score', 'streak_bonus', etc.
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_log_student ON public.xp_log (student_id, created_at DESC);

-- ── BADGES ───────────────────────────────────────────────────
CREATE TABLE public.badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO public.badges (slug, name, description, emoji, sort_order) VALUES
  ('first_quest',    'First Quest',     'Completed your very first assignment',       '⭐', 1),
  ('quiz_master',    'Quiz Master',     'Scored 100% on a quiz',                      '🏆', 2),
  ('high_scorer',    'High Scorer',     'Scored 80% or above on a quiz',              '🎯', 3),
  ('streak_3',       '3-Day Streak',    'Completed assignments 3 days in a row',      '🔥', 4),
  ('streak_7',       '7-Day Streak',    'Completed assignments 7 days in a row',      '⚡', 5),
  ('completionist',  'Completionist',   'Completed every assignment in a class',      '💎', 6),
  ('speed_reader',   'Speed Reader',    'Completed a reading comprehension assignment','📖', 7),
  ('math_whiz',      'Math Whiz',       'Completed a math practice assignment',       '🔢', 8),
  ('wordsmith',      'Wordsmith',       'Completed a spelling practice assignment',   '✏️', 9),
  ('ten_quests',     '10 Quests Done',  'Completed 10 assignments total',             '🗺️', 10);

-- ── STUDENT BADGES ───────────────────────────────────────────
CREATE TABLE public.student_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_id)
);

CREATE INDEX idx_student_badges_student ON public.student_badges (student_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own profile"
  ON public.student_profiles FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Educators read student profiles in their classes"
  ON public.student_profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      JOIN public.classrooms c ON c.id = cm.classroom_id
      WHERE cm.student_id = student_profiles.student_id
        AND c.educator_id = auth.uid()
    )
  );

ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own xp log"
  ON public.xp_log FOR SELECT USING (student_id = auth.uid());

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are publicly readable"
  ON public.badges FOR SELECT USING (true);

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own badges"
  ON public.student_badges FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Educators read badges for students in their classes"
  ON public.student_badges FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      JOIN public.classrooms c ON c.id = cm.classroom_id
      WHERE cm.student_id = student_badges.student_id
        AND c.educator_id = auth.uid()
    )
  );
