-- Extended book metadata
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS pen_name text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS publisher_name text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS edition text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS year_published text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS author_bio text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS also_by text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS isbn_epub text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS isbn_kindle text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS isbn_paperback text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS isbn_hardcover text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS isbn_pdf text;

-- Scene lock
ALTER TABLE writer_scenes ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;

-- Front/back matter sections
CREATE TABLE IF NOT EXISTS writer_book_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES writer_books(id) ON DELETE CASCADE,
  type text NOT NULL,
  zone text NOT NULL DEFAULT 'front',
  enabled boolean DEFAULT true,
  position integer DEFAULT 0,
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Copyright config
CREATE TABLE IF NOT EXISTS writer_copyright (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES writer_books(id) ON DELETE CASCADE UNIQUE,
  author_name text,
  pen_name text,
  edition text,
  year text,
  publisher_name text,
  clauses jsonb DEFAULT '[]',
  collaborators jsonb DEFAULT '[]',
  custom_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
