ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS source_text text;
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS source_pdf_name text;
