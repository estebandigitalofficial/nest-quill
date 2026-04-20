-- ============================================================
-- NEST & QUILL — Initial Schema
-- Run with: supabase db reset
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');

CREATE TYPE story_status AS ENUM (
  'queued',
  'generating_text',
  'generating_images',
  'assembling_pdf',
  'complete',
  'failed',
  'refund_requested'
);

CREATE TYPE image_status AS ENUM ('pending', 'generating', 'complete', 'failed');
CREATE TYPE export_format AS ENUM ('pdf', 'print_ready_pdf');
CREATE TYPE delivery_channel AS ENUM ('email', 'download');
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');
CREATE TYPE log_level AS ENUM ('info', 'warning', 'error');

-- ────────────────────────────────────────────────────────────
-- SHARED: auto-update updated_at on any row change
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- One row per authenticated user. Auto-created on signup.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
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
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function called by the app after a book is generated
CREATE OR REPLACE FUNCTION public.increment_books_generated(user_id_input UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.profiles
  SET books_generated = books_generated + 1
  WHERE id = user_id_input;
$$;

-- ────────────────────────────────────────────────────────────
-- PLANS
-- Static config table — seeded below, not user-editable.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.plans (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier                  plan_tier NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  price_monthly_cents   INTEGER NOT NULL DEFAULT 0,
  stripe_price_id       TEXT,
  books_per_month       INTEGER NOT NULL DEFAULT 1,
  max_pages_per_book    INTEGER NOT NULL DEFAULT 20,
  can_download_pdf      BOOLEAN NOT NULL DEFAULT TRUE,
  can_order_print       BOOLEAN NOT NULL DEFAULT FALSE,
  can_add_dedication    BOOLEAN NOT NULL DEFAULT FALSE,
  features              JSONB NOT NULL DEFAULT '[]',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (tier, display_name, price_monthly_cents, books_per_month,
  max_pages_per_book, can_add_dedication, can_order_print, features)
VALUES
  ('free',     'Free',     0,    1, 16, FALSE, FALSE,
   '["1 book/month", "Up to 16 pages", "8 illustrations", "PDF download"]'),
  ('starter',  'Starter',  1499, 3, 24, FALSE, FALSE,
   '["3 books/month", "Up to 24 pages", "12 illustrations", "3 styles", "Email delivery"]'),
  ('pro',      'Story Pro', 2999, 10, 32, TRUE, TRUE,
   '["10 books/month", "Up to 32 pages", "16 illustrations", "All styles", "Dedication page", "Print ordering"]'),
  ('enterprise','Educator/Commercial', 0, 999, 48, TRUE, TRUE,
   '["Unlimited books", "Up to 48 pages", "Custom style", "White-label"]');

-- ────────────────────────────────────────────────────────────
-- STORY REQUESTS
-- The main record created when a user submits the form.
-- Contains the state machine (status field) for the entire pipeline.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.story_requests (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_token                 UUID,
  plan_tier                   plan_tier NOT NULL DEFAULT 'free',

  -- Story inputs
  child_name                  TEXT NOT NULL CHECK (char_length(child_name) BETWEEN 1 AND 80),
  child_age                   SMALLINT NOT NULL CHECK (child_age BETWEEN 1 AND 12),
  child_description           TEXT CHECK (char_length(child_description) <= 500),
  story_theme                 TEXT NOT NULL CHECK (char_length(story_theme) BETWEEN 3 AND 100),
  story_length                SMALLINT NOT NULL DEFAULT 16
                                CHECK (story_length IN (8, 16, 24, 32)),
  illustration_style          TEXT NOT NULL DEFAULT 'watercolor',
  dedication_text             TEXT CHECK (char_length(dedication_text) <= 300),
  custom_notes                TEXT CHECK (char_length(custom_notes) <= 600),
  locale                      TEXT NOT NULL DEFAULT 'en',
  user_email                  TEXT NOT NULL,

  -- Pipeline state machine
  status                      story_status NOT NULL DEFAULT 'queued',
  status_message              TEXT,
  progress_pct                SMALLINT NOT NULL DEFAULT 0
                                CHECK (progress_pct BETWEEN 0 AND 100),
  worker_id                   TEXT,
  retry_count                 SMALLINT NOT NULL DEFAULT 0,
  last_error                  TEXT,

  -- Payment
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_checkout_session_id  TEXT UNIQUE,
  amount_paid_cents           INTEGER,
  paid_at                     TIMESTAMPTZ,

  -- Timestamps
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_started_at       TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,

  CONSTRAINT must_have_owner CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE INDEX idx_story_requests_user_id ON public.story_requests (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_story_requests_guest_token ON public.story_requests (guest_token)
  WHERE guest_token IS NOT NULL;
CREATE INDEX idx_story_requests_status ON public.story_requests (status)
  WHERE status NOT IN ('complete', 'failed');

CREATE TRIGGER story_requests_updated_at
  BEFORE UPDATE ON public.story_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- GENERATED STORIES
-- The AI-generated story content linked to a request.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.generated_stories (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id          UUID NOT NULL UNIQUE
                        REFERENCES public.story_requests(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  subtitle            TEXT,
  author_line         TEXT NOT NULL DEFAULT 'A Nest & Quill Original',
  dedication          TEXT,
  synopsis            TEXT,
  full_text_json      JSONB NOT NULL,
  raw_llm_output      TEXT,
  model_used          TEXT NOT NULL,
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  generation_time_ms  INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- STORY SCENES
-- One row per page. Tracks text + image generation per page.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.story_scenes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id              UUID NOT NULL
                          REFERENCES public.generated_stories(id) ON DELETE CASCADE,
  request_id            UUID NOT NULL
                          REFERENCES public.story_requests(id) ON DELETE CASCADE,
  page_number           SMALLINT NOT NULL,
  page_text             TEXT NOT NULL,
  image_prompt          TEXT NOT NULL,
  image_status          image_status NOT NULL DEFAULT 'pending',
  image_url             TEXT,
  storage_path          TEXT,
  storage_bucket        TEXT NOT NULL DEFAULT 'story-images',
  image_model           TEXT,
  image_revised_prompt  TEXT,
  generation_attempts   SMALLINT NOT NULL DEFAULT 0,
  last_error            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (story_id, page_number)
);

CREATE INDEX idx_story_scenes_story_id ON public.story_scenes (story_id);
CREATE INDEX idx_story_scenes_request_id ON public.story_scenes (request_id);

CREATE TRIGGER story_scenes_updated_at
  BEFORE UPDATE ON public.story_scenes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- BOOK EXPORTS
-- The finished PDF file reference.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.book_exports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id            UUID NOT NULL
                          REFERENCES public.story_requests(id) ON DELETE CASCADE,
  format                export_format NOT NULL DEFAULT 'pdf',
  storage_path          TEXT NOT NULL,
  storage_bucket        TEXT NOT NULL DEFAULT 'book-exports',
  file_size_bytes       INTEGER,
  page_count            SMALLINT,
  signed_url            TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  render_time_ms        INTEGER,
  is_latest             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_book_exports_request_id ON public.book_exports (request_id);

-- ────────────────────────────────────────────────────────────
-- DELIVERY LOGS
-- Tracks every email/download attempt.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.delivery_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id          UUID NOT NULL
                        REFERENCES public.story_requests(id) ON DELETE CASCADE,
  export_id           UUID REFERENCES public.book_exports(id) ON DELETE SET NULL,
  channel             delivery_channel NOT NULL,
  status              delivery_status NOT NULL DEFAULT 'pending',
  recipient_email     TEXT,
  resend_message_id   TEXT,
  opened_at           TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,
  retry_count         SMALLINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER delivery_logs_updated_at
  BEFORE UPDATE ON public.delivery_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PROCESSING LOGS
-- Append-only event log for debugging the AI pipeline.
-- Admin/service role only — users never see this.
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.processing_logs (
  id          BIGSERIAL PRIMARY KEY,
  request_id  UUID NOT NULL
                REFERENCES public.story_requests(id) ON DELETE CASCADE,
  level       log_level NOT NULL DEFAULT 'info',
  stage       TEXT NOT NULL,
  message     TEXT NOT NULL,
  duration_ms INTEGER,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processing_logs_request_id
  ON public.processing_logs (request_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Users can only see their own data.
-- Admin/service role bypasses RLS entirely.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable"
  ON public.plans FOR SELECT USING (is_active = TRUE);

ALTER TABLE public.story_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read own requests"
  ON public.story_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can insert requests"
  ON public.story_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.generated_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own stories"
  ON public.generated_stories FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.story_requests r
      WHERE r.id = request_id AND r.user_id = auth.uid())
  );

ALTER TABLE public.story_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own scenes"
  ON public.story_scenes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.story_requests r
      WHERE r.id = request_id AND r.user_id = auth.uid())
  );

ALTER TABLE public.book_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own exports"
  ON public.book_exports FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.story_requests r
      WHERE r.id = request_id AND r.user_id = auth.uid())
  );

ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own delivery logs"
  ON public.delivery_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.story_requests r
      WHERE r.id = request_id AND r.user_id = auth.uid())
  );

-- processing_logs: no user policy — service role only
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;
