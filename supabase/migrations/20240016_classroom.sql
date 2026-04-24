-- ============================================================
-- CLASSROOM SYSTEM
-- Educator + Student accounts, classes, assignments, submissions
-- account_type stored in profiles.metadata JSONB (no ALTER needed)
-- ============================================================

-- Update the new-user trigger to capture account_type from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, metadata)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    jsonb_build_object('account_type', COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'parent'))
  );
  RETURN NEW;
END;
$$;

-- ── CLASSROOMS ────────────────────────────────────────────────
CREATE TABLE public.classrooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  grade        SMALLINT CHECK (grade BETWEEN 1 AND 12),
  subject      TEXT,
  join_code    TEXT NOT NULL UNIQUE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classrooms_educator  ON public.classrooms (educator_id);
CREATE INDEX idx_classrooms_join_code ON public.classrooms (join_code);

CREATE TRIGGER classrooms_updated_at
  BEFORE UPDATE ON public.classrooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── CLASSROOM MEMBERS ─────────────────────────────────────────
CREATE TABLE public.classroom_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
);

CREATE INDEX idx_cm_classroom ON public.classroom_members (classroom_id);
CREATE INDEX idx_cm_student   ON public.classroom_members (student_id);

-- ── ASSIGNMENTS ───────────────────────────────────────────────
CREATE TABLE public.assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  tool         TEXT NOT NULL CHECK (tool IN ('quiz','flashcards','explain','study-guide','math','reading','spelling')),
  config       JSONB NOT NULL DEFAULT '{}',
  due_at       TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_classroom ON public.assignments (classroom_id);

CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ASSIGNMENT SUBMISSIONS ────────────────────────────────────
CREATE TABLE public.assignment_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  score           SMALLINT,
  total           SMALLINT,
  status          TEXT NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'complete')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_submissions_assignment ON public.assignment_submissions (assignment_id);
CREATE INDEX idx_submissions_student    ON public.assignment_submissions (student_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Educators manage own classrooms"
  ON public.classrooms FOR ALL USING (educator_id = auth.uid());
CREATE POLICY "Students read classrooms they belong to"
  ON public.classrooms FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.classroom_members m
      WHERE m.classroom_id = id AND m.student_id = auth.uid())
  );

ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Educators see members of their classrooms"
  ON public.classroom_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_id AND c.educator_id = auth.uid())
  );
CREATE POLICY "Students see own memberships"
  ON public.classroom_members FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can join classes"
  ON public.classroom_members FOR INSERT WITH CHECK (student_id = auth.uid());

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Educators manage assignments in own classrooms"
  ON public.assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_id AND c.educator_id = auth.uid())
  );
CREATE POLICY "Students read assignments in their classrooms"
  ON public.assignments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.classroom_members m
      WHERE m.classroom_id = classroom_id AND m.student_id = auth.uid())
  );

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own submissions"
  ON public.assignment_submissions FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Educators read submissions for their classrooms"
  ON public.assignment_submissions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_id AND c.educator_id = auth.uid()
    )
  );
