import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

// Returns list of all admin users (for owner dropdown — super admin only)
export async function GET() {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }
  if (!ctx.isSuperAdmin) return adminGuardResponse()

  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('admin_users')
    .select('user_id, role, display_name')
    .order('display_name', { ascending: true })

  // Include the super admin (from env) as the first entry
  const admins = [
    { userId: ctx.userId, displayName: ctx.displayName, role: 'super_admin' as const },
    ...((rows ?? [])
      .filter(r => r.user_id !== ctx.userId)
      .map(r => ({ userId: r.user_id, displayName: r.display_name, role: r.role as 'admin' | 'super_admin' }))),
  ]

  return NextResponse.json(admins)
}
