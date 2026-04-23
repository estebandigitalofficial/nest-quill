import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimits } from './config'
import type { PlanTier } from '@/types/database'

/**
 * Checks whether a user (or guest) is allowed to create another book.
 *
 * For authenticated users: checks profile.books_generated against plan limit.
 * For guests: counts existing story_requests by guest_token against the free limit.
 */
export async function canCreateBook(
  userId: string | null,
  tier: PlanTier,
  guestToken?: string | null,
): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = createAdminClient()
  const limits = getPlanLimits(tier)
  const limit = limits.booksPerMonth

  if (!userId) {
    // Guests: count non-failed stories submitted under this browser token
    if (!guestToken || tier !== 'free') return { allowed: true }

    const { count, error } = await supabase
      .from('story_requests')
      .select('id', { count: 'exact', head: true })
      .eq('guest_token', guestToken)
      .neq('status', 'failed')

    if (error) return { allowed: true } // fail open

    if ((count ?? 0) >= limit) {
      return { allowed: false, reason: 'Free plan allows 1 story. Sign up to create more.' }
    }

    return { allowed: true }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('books_generated, books_limit')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error('canCreateBook: failed to read profile', error)
    return { allowed: true }
  }

  if (profile.books_generated >= limit) {
    return {
      allowed: false,
      reason: `Your ${tier} plan allows ${limit} book${limit === 1 ? '' : 's'} per month. You've reached your limit.`,
    }
  }

  return { allowed: true }
}

/**
 * Increments the books_generated counter on a user's profile after a book completes.
 * Called by the Edge Function at the end of the pipeline.
 */
export async function incrementBooksGenerated(userId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.rpc('increment_books_generated', { user_id_input: userId })
}
