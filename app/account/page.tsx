import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { StoryRequest, PlanTier } from '@/types/database'
import LogoutButton from '@/components/auth/LogoutButton'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()
  const { data: stories } = await adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, status, progress_pct, plan_tier, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const planTier = (user.user_metadata?.plan_tier as PlanTier) ?? 'free'
  const plan = PLAN_CONFIG[planTier]

  return (
    <div className="min-h-screen bg-brand-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-gray-900">
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

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Account</p>
            <p className="text-gray-900 font-medium">{user.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Current plan</p>
            <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full">
              {plan.displayName}
            </span>
          </div>
        </div>

        {/* Stories */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl text-gray-900">Your stories</h2>
            <Link href="/create" className="text-sm text-brand-600 font-medium hover:text-brand-700">
              + New story
            </Link>
          </div>

          {!stories || stories.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 text-center space-y-3">
              <p className="text-3xl">📖</p>
              <p className="font-serif text-lg text-gray-900">No stories yet</p>
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
              {(stories as unknown as StoryRequest[]).map((story) => (
                <Link
                  key={story.id}
                  href={`/story/${story.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:border-brand-200 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {story.child_name}&apos;s story
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{story.story_theme}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={story.status} />
                      <span className="text-xs text-gray-400">
                        {new Date(story.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    queued: 'bg-gray-100 text-gray-500',
    generating_text: 'bg-brand-100 text-brand-700',
    generating_images: 'bg-brand-100 text-brand-700',
    assembling_pdf: 'bg-brand-100 text-brand-700',
  }
  const labels: Record<string, string> = {
    complete: 'Complete',
    failed: 'Failed',
    queued: 'Queued',
    generating_text: 'Writing…',
    generating_images: 'Illustrating…',
    assembling_pdf: 'Assembling…',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}
