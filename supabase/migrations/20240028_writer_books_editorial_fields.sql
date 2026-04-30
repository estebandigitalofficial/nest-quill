ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS audience         text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS purpose          text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS voice_notes      text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS structural_notes text;