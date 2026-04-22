import type { Metadata } from 'next'
import StoryStatusPage from '@/components/story/StoryStatusPage'
import { getAdminContext } from '@/lib/admin/guard'

export const metadata: Metadata = {
  title: 'Your Story — Nest & Quill',
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const adminCtx = await getAdminContext()
  return <StoryStatusPage requestId={requestId} isAdmin={!!adminCtx} />
}
