import type { Metadata } from 'next'
import StoryStatusPage from '@/components/story/StoryStatusPage'

export const metadata: Metadata = {
  title: 'Your Story — Nest & Quill',
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  return <StoryStatusPage requestId={requestId} />
}
