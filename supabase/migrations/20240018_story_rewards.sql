-- ============================================================
-- STORY REWARDS — personalized story unlocks for students
-- ============================================================

-- Add story_hero badge
INSERT INTO public.badges (slug, name, description, emoji, sort_order) VALUES
  ('story_hero', 'Story Hero', 'Earned a personalized learning story reward', '📖', 11)
ON CONFLICT (slug) DO NOTHING;

-- Track which students have earned story rewards and from which milestones
CREATE TABLE IF NOT EXISTS public.student_story_rewards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_request_id UUID NOT NULL REFERENCES public.story_requests(id) ON DELETE CASCADE,
  milestone_number SMALLINT NOT NULL,
  awarded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_story_rewards_student
  ON public.student_story_rewards (student_id, awarded_at DESC);

ALTER TABLE public.student_story_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own story rewards"
  ON public.student_story_rewards FOR SELECT USING (student_id = auth.uid());
