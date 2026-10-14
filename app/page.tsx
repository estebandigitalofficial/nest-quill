import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin/guard'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n'
import SiteHeader from '@/components/layout/SiteHeader'
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

  const lang = await getServerLang()
  const t = getDictionary(lang)

  // Same SiteHeader as every other route, so the header is identical site-wide.
  return (
    <>
      <SiteHeader
        right={
          !user ? (
            <Link
              href="/login"
              className="hidden sm:inline text-sm font-semibold text-oxford hover:text-brand-600 whitespace-nowrap"
            >
              {t.nav.signIn}
            </Link>
          ) : null
        }
      />
      <ModernHome />
    </>
  )
}
