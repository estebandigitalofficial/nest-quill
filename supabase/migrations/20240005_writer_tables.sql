-- Admin Book Writer tables
-- Completely separate from the children's storybook system

CREATE TABLE writer_books (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                     TEXT NOT NULL,
  subtitle                  TEXT,
  genre                     TEXT NOT NULL,
  tone                      TEXT NOT NULL,
  premise                   TEXT NOT NULL,
  target_chapters           INTEGER NOT NULL DEFAULT 10,
  target_words_per_chapter  INTEGER NOT NULL DEFAULT 2000,
  status                    TEXT NOT NULL DEFAULT 'draft',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE writer_chapters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         UUID NOT NULL REFERENCES writer_books(id) ON DELETE CASCADE,
  chapter_number  INTEGER NOT NULL,
  title           TEXT NOT NULL,
  brief           TEXT NOT NULL,
  summary         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, chapter_number)
);

CREATE TABLE writer_scenes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id      UUID NOT NULL REFERENCES writer_chapters(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES writer_books(id) ON DELETE CASCADE,
  scene_number    INTEGER NOT NULL,
  brief           TEXT NOT NULL,
  content         TEXT,
  word_count      INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending',
  model_used      TEXT,
  generation_time_ms INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, scene_number)
);

CREATE TABLE writer_scene_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id    UUID NOT NULL REFERENCES writer_scenes(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  content     TEXT NOT NULL,
  word_count  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
