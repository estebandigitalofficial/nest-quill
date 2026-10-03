import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin/guard'
import ModernHome from '@/components/home/ModernHome'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const adminCtx = await getAdminContext()
    if (adminCtx) redirect('/admin')
  }

  // Modernized homepage (design_handoff_nestandquill_modernized). Language is
  // supplied by the client LanguageProvider, which was seeded from the cookie
  // in the root layout, so first paint is already in the right language.
  return <ModernHome isAuthed={!!user} />
}
