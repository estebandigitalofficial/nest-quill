import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StoryWizard from '@/components/story/wizard/StoryWizard'
import { getSetting } from '@/lib/settings/appSettings'
import { isSettingEnabled } from '@/lib/settings/gates'
import { getQueuePressure } from '@/lib/limits/rateLimits'

export const metadata: Metadata = {
  title: 'Create Your Story',
  description: 'Personalize a storybook for your child in minutes — choose a theme, add their name, and we\'ll write and illustrate it with AI.',
  openGraph: {
    title: 'Create a Personalized Storybook — Nest & Quill',
    description: 'Personalize a storybook for your child in minutes — choose a theme, add their name, and we\'ll write and illustrate it with AI.',
  },
}

export default async function CreatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Beta-ops gates first — short-circuit before any heavier reads if the
  // wizard isn't accepting submissions right now.
  const [storyOpen, guestOpen] = await Promise.all([
    isSettingEnabled('story_creation_enabled'),
    isSettingEnabled('guest_story_creation_enabled'),
  ])
  if (!storyOpen) return <CreateUnavailable mode="paused" />
  if (!user && !guestOpen) return <CreateUnavailable mode="signin_required" />

  // Soft queue-pressure check for the UI. Hard guest blocks happen
  // server-side at submit time; this is just expectation-setting.
  const queue = await getQueuePressure()

  // Fetch live limits, user profile, and beta mode in parallel
  const [[guestLimit, freeLimit, betaMode], profileResult] = await Promise.all([
    Promise.all([
      getSetting('guest_story_limit', 1),
      getSetting('free_user_story_limit', 2),
      getSetting('beta_mode_enabled', false),
    ]),
    user
      ? createAdminClient()
          .from('profiles')
          .select('plan_tier, books_generated, is_admin')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const profile = 'data' in profileResult ? profileResult.data : null
  const planTier     = profile?.plan_tier     ?? 'free'
  const booksGenerated = profile?.books_generated ?? 0
  const isAdmin      = profile?.is_admin      ?? false

  const isGuest = !user
  const isFree  = planTier === 'free'
  const atLimit = !isAdmin && isFree && booksGenerated >= freeLimit

  // Pluralise "story" / "stories"
  const stories = (n: number) => `${n} ${n === 1 ? 'story' : 'stories'}`

  return (
    <div className="py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-serif text-oxford mb-2">
            Create Your Story
          </h1>
          <p className="text-charcoal-light text-sm">
            A personalized illustrated storybook in minutes.
          </p>
        </div>

        {/* Usage banner */}
        {!isAdmin && (
          <div className="mb-6">
            {isGuest && (
              <p className="text-center text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                Try {stories(guestLimit)} free without an account.{' '}
                <Link href="/signup" className="text-brand-600 font-medium hover:text-brand-700">
                  Create a free account
                </Link>{' '}
                for {stories(freeLimit)}.
              </p>
            )}
            {!isGuest && isFree && !atLimit && (
              <p className="text-center text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                <span className="font-semibold text-gray-700">{booksGenerated} / {freeLimit}</span> free stories used.{' '}
                <Link href="/pricing" className="text-brand-600 font-medium hover:text-brand-700">
                  Upgrade
                </Link>{' '}
                for unlimited stories.
              </p>
            )}
            {!isGuest && isFree && atLimit && (
              <div className="text-center bg-brand-50 border border-brand-200 rounded-xl px-5 py-3.5 space-y-2">
                <p className="text-sm font-semibold text-oxford">
                  You&apos;ve reached your free limit ({freeLimit} / {freeLimit} stories used)
                </p>
                <p className="text-xs text-charcoal-light">Upgrade your plan to create more personalized storybooks.</p>
                <Link
                  href="/pricing"
                  className="inline-block mt-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  See plans →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Beta mode notice */}
        {betaMode && (
          <div className="mb-6 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            Beta Mode active — some features may be simulated.
          </div>
        )}

        {/* Queue pressure notices. Critical → no submissions accepted
            (server-side gate also enforces). Warning → expectation-set
            but signed-in users can still submit. */}
        {queue.level === 'critical' && (
          <div className="mb-6 text-center text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <strong className="block">High demand right now</strong>
            <span className="text-xs">The story queue is at capacity. Please try again in a few minutes — your story is safe to come back to.</span>
          </div>
        )}
        {queue.level === 'warning' && (
          <div className="mb-6 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            High demand — your story may take a little longer to start. Thanks for your patience!
          </div>
        )}

        <Suspense>
          <StoryWizard betaMode={betaMode as boolean} accountPlan={planTier} />
        </Suspense>
      </div>
    </div>
  )
}

function CreateUnavailable({ mode }: { mode: 'paused' | 'signin_required' }) {
  const isPaused = mode === 'paused'
  return (
    <div className="py-16 px-4">
      <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-10">
        <p className="text-3xl">{isPaused ? '🛠️' : '🔒'}</p>
        <h1 className="font-serif text-2xl text-oxford mt-3">
          {isPaused ? 'Story creation is paused' : 'Sign in to create a story'}
        </h1>
        <p className="text-sm text-charcoal-light mt-2">
          {isPaused
            ? "We're polishing things up. Existing stories are unaffected — please check back in a few minutes."
            : 'Guest creation is paused right now. Sign in or create a free account to continue.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {!isPaused && (
            <>
              <Link href="/signup" className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-full">
                Create account
              </Link>
              <Link href="/login" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full">
                Sign in
              </Link>
            </>
          )}
          <Link href="/" className="text-sm text-brand-600 font-medium hover:text-brand-700 px-4 py-2">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
