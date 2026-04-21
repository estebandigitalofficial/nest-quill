import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminContext = {
  userId: string
  isSuperAdmin: boolean
  isAdmin: boolean
  displayName: string
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Super admin via env var bootstrap
  if (user.email === process.env.ADMIN_EMAIL) {
    return {
      userId: user.id,
      isSuperAdmin: true,
      isAdmin: true,
      displayName: user.email ?? user.id,
    }
  }

  // Check admin_users table for additional admins
  const adminSupabase = createAdminClient()
  const { data } = await adminSupabase
    .from('admin_users')
    .select('role, display_name')
    .eq('user_id', user.id)
    .single()

  if (!data) return null

  return {
    userId: user.id,
    isSuperAdmin: data.role === 'super_admin',
    isAdmin: true,
    displayName: data.display_name,
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
