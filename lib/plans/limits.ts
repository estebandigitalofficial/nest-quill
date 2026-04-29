import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimits } from './config'
import type { PlanTier } from '@/types/database'

// Guest (no account): 1 story, identified by email
const GUEST_LIMIT = 1
// Free account (logged-in): 2 stories, checked via books_generated
export const FREE_ACCOUNT_LIMIT = 2

/**
 * Checks whether a user (or guest) is allowed to create another book.
 *
 * Guests:         email-based count from story_requests, limit = 1
 * Free accounts:  books_generated counter, limit = 2; admins always pass
 * Paid accounts:  books_generated counter vs plan limit
 */
export async function canCreateBook(
  userId: string | null,
  tier: PlanTier,
  guestToken?: string | null,
  userEmail?: string | null,
): Promise<{ allowed: boolean; reason?: string; requiresSignup?: boolean }> {
  const supabase = createAdminClient()

  // ── Guest path ──────────────────────────────────────────────────────────────
  if (!userId) {
    // Non-free tier as guest is impossible in the current flow, but fail open.
    if (tier !== 'free') return { allowed: true }

    if (userEmail) {
      const { count, error } = await supabase
        .from('story_requests')
        .select('id', { count: 'exact', head: true })
        .is('user_id', null)
        .eq('user_email', userEmail)
        .neq('status', 'failed')

      if (!error && (count ?? 0) >= GUEST_LIMIT) {
        return {
          allowed: false,
          requiresSignup: true,
          reason: "You've used your free story. Create an account to continue.",
        }
      }
    }

    return { allowed: true }
  }

  // ── Logged-in path ──────────────────────────────────────────────────────────
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('books_generated, books_limit, is_admin')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error('canCreateBook: failed to read profile', error)
    return { allowed: true } // fail open
  }

  // Admins bypass all limits.
  if (profile.is_admin) return { allowed: true }

  if (tier === 'free') {
    if (profile.books_generated >= FREE_ACCOUNT_LIMIT) {
      return {
        allowed: false,
        reason: "You've reached your free limit. Upgrade to continue.",
      }
    }
    return { allowed: true }
  }

  // Paid tiers: use plan's booksPerMonth against the books_generated counter.
  const limits = getPlanLimits(tier)
  const limit = limits.booksPerMonth

  if (profile.books_generated >= limit) {
    return {
      allowed: false,
      reason: `Your ${tier} plan allows ${limit} book${limit === 1 ? '' : 's'} per month. You've reached your limit.`,
    }
  }

  return { allowed: true }
}

// Usage increment is handled in app/api/story/status/route.ts via the
// usage_counted guard — do not add a second increment path here.
