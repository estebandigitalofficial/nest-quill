import type { Metadata } from 'next'
import StoryStatusPage from '@/components/story/StoryStatusPage'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getAdminContext } from '@/lib/admin/guard'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = {
  title: 'Your Story — Nest & Quill',
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const [adminCtx, betaMode] = await Promise.all([
    getAdminContext(),
    getSetting('beta_mode_enabled', false),
  ])
  // SiteHeader / SiteFooter are async server components that hit the admin
  // Supabase client to read app_settings. Importing them directly into
  // StoryStatusPage ('use client') was pulling SUPABASE_SERVICE_ROLE_KEY
  // into the client bundle and crashing on render. Pre-rendering them here
  // and passing through as props keeps the server-only execution server-side.
  return (
    <StoryStatusPage
      requestId={requestId}
      isAdmin={!!adminCtx}
      betaMode={betaMode as boolean}
      header={<SiteHeader />}
      footer={<SiteFooter />}
    />
  )
}
