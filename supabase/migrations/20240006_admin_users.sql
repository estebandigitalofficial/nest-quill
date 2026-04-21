-- Admin users registry for multi-admin book writer ownership
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'super_admin')) DEFAULT 'admin',
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Add ownership to writer books
ALTER TABLE writer_books ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
