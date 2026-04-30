-- RLS policies for writer_books: all admins can read, only owner can write.
--
-- All API routes use createAdminClient() (service role) which bypasses RLS,
-- so these policies are defense-in-depth. Ownership is enforced at the
-- application layer via checkBookOwner() in lib/admin/guard.ts.

-- SELECT: any authenticated user can read all books (admin-only pages are
-- protected at the app layer via getAdminContext).
CREATE POLICY "Admins can read all writer_books"
  ON writer_books FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only the creating admin can insert (their user id must be the owner).
CREATE POLICY "Admins can insert own writer_books"
  ON writer_books FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: only the owner can update their own book.
CREATE POLICY "Admins can update own writer_books"
  ON writer_books FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- DELETE: only the owner can delete their own book.
CREATE POLICY "Admins can delete own writer_books"
  ON writer_books FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
