import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin/guard'
import { getSetting } from '@/lib/settings/appSettings'
import SiteHeader from '@/components/layout/SiteHeader'
import ModernHome from '@/components/home/ModernHome'
import SiteFooter from '@/components/layout/SiteFooter'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const adminCtx = await getAdminContext()
    if (adminCtx) redirect('/admin')
  }

  const [betaMode, imagesPaused] = await Promise.all([
    getSetting('beta_mode_enabled', false) as Promise<boolean>,
    // Illustrations are governed by image_generation_enabled, not by beta.
    getSetting<unknown>('image_generation_enabled', true).then(v => v === false),
  ])
  // Same SiteHeader and SiteFooter as every other route, so header and footer
  // are identical site-wide (UserControls inside the header renders Sign in
  // for logged-out visitors). The homepage has no mobile tab bar yet; that is
  // a separate approved task, so the footer is told not to render one.
  return (
    <>
      <SiteHeader />
      <ModernHome betaMode={betaMode === true} imagesPaused={imagesPaused} />
      <SiteFooter tabBar={false} />
    </>
  )
}
