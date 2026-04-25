-- Add IP + geo columns to story_requests for admin location visibility
ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS ip_address  TEXT,
  ADD COLUMN IF NOT EXISTS geo_city    TEXT,
  ADD COLUMN IF NOT EXISTS geo_country TEXT,
  ADD COLUMN IF NOT EXISTS geo_region  TEXT;
