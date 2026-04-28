import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StoryWizard from '@/components/story/wizard/StoryWizard'
import { FREE_ACCOUNT_LIMIT } from '@/lib/plans/limits'

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

  let planTier: string = 'free'
  let booksGenerated = 0
  let isAdmin = false

  if (user) {
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('plan_tier, books_generated, is_admin')
      .eq('id', user.id)
      .single()

    planTier = profile?.plan_tier ?? 'free'
    booksGenerated = profile?.books_generated ?? 0
    isAdmin = profile?.is_admin ?? false
  }

  const isGuest = !user
  const isFree = planTier === 'free'
  const atLimit = !isAdmin && isFree && booksGenerated >= FREE_ACCOUNT_LIMIT

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
                Try 1 story free without an account.{' '}
                <Link href="/signup" className="text-brand-600 font-medium hover:text-brand-700">
                  Create a free account
                </Link>{' '}
                for 2 stories.
              </p>
            )}
            {!isGuest && isFree && !atLimit && (
              <p className="text-center text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                <span className="font-semibold text-gray-700">{booksGenerated} / {FREE_ACCOUNT_LIMIT}</span> free stories used.{' '}
                <Link href="/pricing" className="text-brand-600 font-medium hover:text-brand-700">
                  Upgrade
                </Link>{' '}
                for unlimited stories.
              </p>
            )}
            {!isGuest && isFree && atLimit && (
              <div className="text-center bg-brand-50 border border-brand-200 rounded-xl px-5 py-3.5 space-y-2">
                <p className="text-sm font-semibold text-oxford">
                  You&apos;ve reached your free limit ({FREE_ACCOUNT_LIMIT} / {FREE_ACCOUNT_LIMIT} stories used)
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

        <Suspense>
          <StoryWizard />
        </Suspense>
      </div>
    </div>
  )
}
