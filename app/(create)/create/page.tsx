import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StoryWizard from '@/components/story/wizard/StoryWizard'
import { getSetting } from '@/lib/settings/appSettings'
import { getLaunchFlags } from '@/lib/launch/flags'
import { isSettingEnabled } from '@/lib/settings/gates'
import { getQueuePressure } from '@/lib/limits/rateLimits'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, fill, plural, type Dictionary } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  const m = getDictionary(lang).meta.pages
  return {
    title: m.create,
    description: m.createDescription,
    openGraph: { title: `${m.create} — Nest & Quill`, description: m.createDescription },
  }
}

export default async function CreatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lang = await getServerLang()
  const t = getDictionary(lang)

  // Beta-ops gates first — short-circuit before any heavier reads if the
  // wizard isn't accepting submissions right now.
  const [storyOpen, guestOpen] = await Promise.all([
    isSettingEnabled('story_creation_enabled'),
    isSettingEnabled('guest_story_creation_enabled'),
  ])
  if (!storyOpen) return <CreateUnavailable mode="paused" t={t} />
  if (!user && !guestOpen) return <CreateUnavailable mode="signin_required" t={t} />

  // Soft queue-pressure check for the UI. Hard guest blocks happen
  // server-side at submit time; this is just expectation-setting.
  const queue = await getQueuePressure()

  const flags = await getLaunchFlags()
  const [[guestLimit, freeLimit, betaMode, imageGenSetting], profileResult] = await Promise.all([
    Promise.all([
      getSetting('guest_story_limit', 1),
      getSetting('free_user_story_limit', 2),
      getSetting('beta_mode_enabled', false),
      getSetting<unknown>('image_generation_enabled', true),
    ]),
    user
      ? createAdminClient()
          .from('profiles')
          .select('plan_tier, free_books_used, is_admin')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const profile = 'data' in profileResult ? profileResult.data : null
  const planTier     = profile?.plan_tier     ?? 'free'
  const booksGenerated = Number((profile as { free_books_used?: number } | null)?.free_books_used ?? 0)
  const isAdmin      = profile?.is_admin      ?? false

  const isGuest = !user
  const isFree  = planTier === 'free'
  const atLimit = !isAdmin && isFree && booksGenerated >= Number(freeLimit)
  const c = t.create
  const stories = (n: number) => plural(lang, c.stories, n)

  return (
    <div className="py-8 sm:py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-serif text-oxford mb-2">{c.heading}</h1>
          <p className="text-charcoal-light text-sm">{c.sub}</p>
        </div>

        {/* Usage banner */}
        {!isAdmin && (
          <div className="mb-6">
            {isGuest && (
              <p className="text-center text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                {fill(c.guestBanner, { n: stories(Number(guestLimit)) })}{' '}
                <Link href="/signup" className="text-brand-600 font-medium hover:text-brand-700">
                  {c.guestLink}
                </Link>{' '}
                {fill(c.guestFor, { n: stories(Number(freeLimit)) })}
              </p>
            )}
            {!isGuest && isFree && !atLimit && (
              <p className="text-center text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                <span className="font-semibold text-gray-700">{fill(c.freeUsed, { used: booksGenerated, limit: Number(freeLimit) })}</span>{' '}
                <Link href="/pricing" className="text-brand-600 font-medium hover:text-brand-700">
                  {c.upgrade}
                </Link>{' '}
                {c.upgradeFor}
              </p>
            )}
            {!isGuest && isFree && atLimit && (
              <div className="text-center bg-brand-50 border border-brand-200 rounded-xl px-5 py-3.5 space-y-2">
                <p className="text-sm font-semibold text-oxford">{c.limitHeading}</p>
                <p className="text-xs text-charcoal-light">{c.limitSub}</p>
                <Link
                  href="/pricing"
                  className="inline-block mt-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  {c.seePlans}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Beta mode notice */}
        {betaMode && (
          <div className="mb-6 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            {c.betaNotice}
          </div>
        )}

        {/* Queue pressure notices. Critical → no submissions accepted
            (server-side gate also enforces). Warning → expectation-set
            but signed-in users can still submit. */}
        {queue.level === 'critical' && (
          <div className="mb-6 text-center text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <strong className="block">{c.queueCriticalTitle}</strong>
            <span className="text-xs">{c.queueCriticalBody}</span>
          </div>
        )}
        {queue.level === 'warning' && (
          <div className="mb-6 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            {c.queueWarning}
          </div>
        )}

        <Suspense>
          <StoryWizard betaMode={betaMode as boolean} imagesPaused={imageGenSetting === false} learningModeEnabled={flags.learningTools} extendedAudiences={flags.extendedAudiences} accountPlan={planTier} />
        </Suspense>
      </div>
    </div>
  )
}

function CreateUnavailable({ mode, t }: { mode: 'paused' | 'signin_required'; t: Dictionary }) {
  const isPaused = mode === 'paused'
  const c = t.create
  return (
    <div className="py-16 px-4">
      <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-10">
        <p className="text-3xl">{isPaused ? '🛠️' : '🔒'}</p>
        <h1 className="font-serif text-2xl text-oxford mt-3">{isPaused ? c.pausedTitle : c.signinTitle}</h1>
        <p className="text-sm text-charcoal-light mt-2">{isPaused ? c.pausedBody : c.signinBody}</p>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {!isPaused && (
            <>
              <Link href="/signup" className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-full">
                {c.createAccount}
              </Link>
              <Link href="/login" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full">
                {c.signIn}
              </Link>
            </>
          )}
          <Link href="/" className="text-sm text-brand-600 font-medium hover:text-brand-700 px-4 py-2">
            {c.backHome}
          </Link>
        </div>
      </div>
    </div>
  )
}
