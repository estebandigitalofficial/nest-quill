import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminContext = {
  userId: string
  isSuperAdmin: boolean
  isAdmin: boolean
  displayName: string
}

// Reads ADMIN_EMAILS (comma-separated) with ADMIN_EMAIL as fallback
function getAdminEmails(): string[] {
  const list = process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? ''
  return list.split(',').map(e => e.trim()).filter(Boolean)
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return null

  // Primary: profiles.is_admin (source of truth going forward)
  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdminByProfile = profile?.is_admin === true

  // Fallback: ADMIN_EMAILS env var (kept so we can never fully lock out)
  const isAdminByEnv = getAdminEmails().includes(user.email)

  if (!isAdminByProfile && !isAdminByEnv) return null

  return {
    userId: user.id,
    isSuperAdmin: true,
    isAdmin: true,
    displayName: user.email,
  }
}

export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext()
  if (!ctx) throw new Error('Unauthorized')
  return ctx
}

// One-off exception: this editor may also edit books owned by the account below.
const EXCEPTION_EDITOR_EMAIL = 'esteban.digitalofficial@gmail.com'
const EXCEPTION_OWNER_EMAIL  = 'nestandquillbooks@gmail.com'

export async function checkBookOwner(bookId: string, ctx: AdminContext): Promise<boolean> {
  const supabase = createAdminClient()
  const { data: book } = await supabase
    .from('writer_books')
    .select('owner_id')
    .eq('id', bookId)
    .single()

  if (!book?.owner_id) return false

  // Normal rule: user owns the book.
  if (book.owner_id === ctx.userId) return true

  // Exception: Esteban may edit/delete books owned by the Nest & Quill Books account.
  if (ctx.displayName === EXCEPTION_EDITOR_EMAIL) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', book.owner_id)
      .single()
    if (ownerProfile?.email === EXCEPTION_OWNER_EMAIL) return true
  }

  return false
}

export function adminGuardResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 403 })
}
