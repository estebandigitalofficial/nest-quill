import type { Metadata } from 'next'
import StoryStatusPage from '@/components/story/StoryStatusPage'
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
  return <StoryStatusPage requestId={requestId} isAdmin={!!adminCtx} betaMode={betaMode as boolean} />
}
