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

  if (!getAdminEmails().includes(user.email)) return null

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

export async function checkBookOwner(bookId: string, ctx: AdminContext): Promise<boolean> {
  if (ctx.isSuperAdmin) return true
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('writer_books')
    .select('owner_id')
    .eq('id', bookId)
    .single()
  return data?.owner_id === ctx.userId
}

export function adminGuardResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 403 })
}
