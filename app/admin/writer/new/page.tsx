import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import NewBookForm from '@/components/admin/writer/NewBookForm'

export default async function NewBookPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  // Fetch admin users list for the owner dropdown (super admin only)
  let adminUsers: { userId: string; displayName: string; role: 'admin' | 'super_admin' }[] = [
    { userId: ctx.userId, displayName: ctx.displayName, role: ctx.isSuperAdmin ? 'super_admin' : 'admin' },
  ]

  if (ctx.isSuperAdmin) {
    const supabase = createAdminClient()
    const { data: rows } = await supabase
      .from('admin_users')
      .select('user_id, role, display_name')
      .order('display_name', { ascending: true })

    if (rows) {
      const others = rows
        .filter(r => r.user_id !== ctx.userId)
        .map(r => ({ userId: r.user_id, displayName: r.display_name, role: r.role as 'admin' | 'super_admin' }))
      adminUsers = [...adminUsers, ...others]
    }
  }

  return (
    <NewBookForm
      isSuperAdmin={ctx.isSuperAdmin}
      currentUserId={ctx.userId}
      adminUsers={adminUsers}
    />
  )
}
