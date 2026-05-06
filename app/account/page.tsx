import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { StoryRequest, PlanTier } from '@/types/database'
import LogoutButton from '@/components/auth/LogoutButton'
import SiteFooter from '@/components/layout/SiteFooter'
import StoryRow from '@/components/account/StoryRow'
import { loadThumbs } from '@/components/account/loadThumbs'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminCtx = await getAdminContext()
  if (adminCtx) redirect('/admin')

  const adminSupabase = createAdminClient()

  // Active stories — excludes archived. The archived list lives at /account/archived.
  const { data: stories } = await adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, status, progress_pct, plan_tier, created_at, archived_at')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const rows = (stories ?? []) as unknown as StoryRequest[]

  // Count archived for the link badge
  const { count: archivedCount } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('archived_at', 'is', null)

  const thumbMap = await loadThumbs(rows.filter(s => s.status === 'complete').map(s => s.id))

  const planTier = (user.user_metadata?.plan_tier as PlanTier) ?? 'free'
  const plan = PLAN_CONFIG[planTier]

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <header className="bg-parchment/95 border-b border-parchment-dark backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-oxford">
            Nest &amp; Quill
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/create" className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
              Create a story →
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-charcoal-light uppercase tracking-widest font-semibold mb-1">Account</p>
              <p className="text-oxford font-medium">{user.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Current plan</p>
              <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full">
                {plan.displayName}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-oxford">Your stories</h2>
              <div className="flex items-center gap-4">
                {(archivedCount ?? 0) > 0 && (
                  <Link href="/account/archived" className="text-sm text-gray-500 hover:text-oxford font-medium">
                    Archived ({archivedCount})
                  </Link>
                )}
                <Link href="/create" className="text-sm text-brand-600 font-medium hover:text-brand-700">
                  + New story
                </Link>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 text-center space-y-3">
                <p className="font-serif text-lg text-oxford">No stories yet</p>
                <p className="text-sm text-gray-500">Create your first personalized storybook.</p>
                <Link
                  href="/create"
                  className="inline-block mt-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  Create a story →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map(story => (
                  <StoryRow key={story.id} story={story} thumbUrl={thumbMap[story.id]} mode="archive" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}

