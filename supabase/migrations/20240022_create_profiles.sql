-- Create profiles table (defined in initial schema but never applied to production)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  display_name       TEXT,
  avatar_url         TEXT,
  stripe_customer_id TEXT UNIQUE,
  plan_tier          plan_tier NOT NULL DEFAULT 'free',
  books_generated    INTEGER NOT NULL DEFAULT 0,
  books_limit        INTEGER NOT NULL DEFAULT 1,
  is_admin           BOOLEAN NOT NULL DEFAULT FALSE,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every write
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row whenever someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper called by the Edge Function after a story is generated
CREATE OR REPLACE FUNCTION public.increment_books_generated(user_id_input UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.profiles
  SET books_generated = books_generated + 1
  WHERE id = user_id_input;
$$;

-- Backfill all existing auth users who have no profile row yet
INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Mark admin accounts
UPDATE public.profiles
SET is_admin = true
WHERE email IN (
  SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
);

-- Fallback: explicitly mark known admin emails
UPDATE public.profiles
SET is_admin = true
WHERE email IN ('esteban.digitalofficial@gmail.com', 'digitalofficialstudio@gmail.com');
