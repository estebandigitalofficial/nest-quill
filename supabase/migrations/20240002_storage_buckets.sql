-- ============================================================
-- Storage Buckets
-- Both buckets are private — files are only accessible via signed URLs.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'story-images',
    'story-images',
    FALSE,
    10485760,  -- 10MB per image
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'book-exports',
    'book-exports',
    FALSE,
    52428800,  -- 50MB per PDF
    ARRAY['application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role writes, owners read via signed URL
-- (Signed URLs work without RLS policies — the URL itself is the auth token)
