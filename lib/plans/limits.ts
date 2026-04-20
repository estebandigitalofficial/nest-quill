import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimits } from './config'
import type { PlanTier } from '@/types/database'

/**
 * Checks whether a user (or guest) is allowed to create another book.
 *
 * For authenticated users: checks profile.books_generated against plan limit.
 * For guests: always allowed in Phase 1 (no persistent tracking across sessions).
 */
export async function canCreateBook(
  userId: string | null,
  tier: PlanTier
): Promise<{ allowed: boolean; reason?: string }> {
  // Guests are always allowed — they have no persistent account to track
  if (!userId) {
    return { allowed: true }
  }

  const supabase = createAdminClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('books_generated, books_limit')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    // If we can't read the profile, allow them through rather than blocking
    console.error('canCreateBook: failed to read profile', error)
    return { allowed: true }
  }

  const limits = getPlanLimits(tier)
  const monthlyLimit = limits.booksPerMonth

  if (profile.books_generated >= monthlyLimit) {
    return {
      allowed: false,
      reason: `Your ${tier} plan allows ${monthlyLimit} book${monthlyLimit === 1 ? '' : 's'} per month. You've reached your limit.`,
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
