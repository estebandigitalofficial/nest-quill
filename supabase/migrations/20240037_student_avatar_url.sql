-- ============================================================
-- STUDENT AVATAR PHOTOS
-- Add avatar_url for uploaded profile photos and a public bucket
-- to store them. Falls back to avatar_color + initials in the UI
-- when no photo is set.
-- ============================================================

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-avatars',
  'student-avatars',
  TRUE,
  2097152, -- 2MB per avatar
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
