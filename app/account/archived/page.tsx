import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import type { StoryRequest } from '@/types/database'
import LogoutButton from '@/components/auth/LogoutButton'
import SiteFooter from '@/components/layout/SiteFooter'
import StoryList from '@/components/account/StoryList'
import { loadThumbs } from '@/components/account/loadThumbs'
import { PAGE_SIZE } from '@/components/account/pageSize'

export default async function ArchivedStoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminCtx = await getAdminContext()
  if (adminCtx) redirect('/admin')

  const adminSupabase = createAdminClient()

  const { data: stories } = await adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, status, created_at, archived_at')
    .eq('user_id', user.id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
    .limit(PAGE_SIZE)

  const rows = (stories ?? []) as unknown as StoryRequest[]
  const thumbMap = await loadThumbs(rows.filter(s => s.status === 'complete').map(s => s.id))

  const lastRow = rows[rows.length - 1]
  const initialNextCursor =
    rows.length < PAGE_SIZE || !lastRow
      ? null
      : (lastRow.archived_at as string | null) ?? null

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <header className="bg-parchment/95 border-b border-parchment-dark backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-oxford">
            Nest &amp; Quill
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/account" className="text-sm text-charcoal-light hover:text-oxford">← Back to my stories</Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <div>
            <h2 className="font-serif text-xl text-oxford">Archived stories</h2>
            <p className="text-sm text-charcoal-light mt-1">
              Hidden from your main list but not deleted. Restore any story to put it back.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 text-center space-y-2">
              <p className="font-serif text-lg text-oxford">Nothing archived</p>
              <p className="text-sm text-gray-500">Stories you archive from your dashboard will appear here.</p>
              <Link href="/account" className="inline-block mt-2 text-sm text-brand-600 font-medium hover:text-brand-700">
                ← Back to your stories
              </Link>
            </div>
          ) : (
            <StoryList
              initialRows={rows.map(story => ({ story, thumbUrl: thumbMap[story.id] ?? null }))}
              initialNextCursor={initialNextCursor}
              mode="restore"
              archivedView
            />
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
