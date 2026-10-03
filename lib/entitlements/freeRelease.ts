/**
 * FREE-only release after a terminal technical failure (pre-deployment
 * hardening). Paid sources (purchase, subscription) are deliberately NOT
 * handled here or anywhere else automatically: support restores those.
 *
 * Rule:
 *   - reserved at submit (reserveEntitlement), kept through retry, worker
 *     continuation, sweep recovery, force requeue and image backfill;
 *   - released EXACTLY ONCE when the story is in a terminal failed state
 *     (not retryable by the user: marked permanently failed, non-retryable
 *     failure code, or retry cap reached) and it never completed;
 *   - a completed Free book permanently consumes the slot (usage_counted
 *     is set at completion and never reset; archive does not touch it);
 *   - guests are not counted here: a failed guest row is simply excluded
 *     from the guest count, which is the only guest "slot".
 *
 * The decision is pure; the SQL function release_free_reservation enforces
 * free-only, account-only, failed, never-completed and once-only atomically.
 */

import { checkRetryEligibility } from '../limits/retryRules.ts'

export interface FreeReleaseFields {
  entitlement_source?: string | null
  user_id?: string | null
  status?: string | null
  usage_counted?: boolean | null
  entitlement_released_at?: string | null
  failure_code?: string | null
  retryable?: boolean | null
  retry_count?: number | null
  retry_after?: string | null
}

export type FreeReleaseDecision =
  | { release: true }
  | { release: false; reason: 'not_free' | 'guest' | 'not_failed' | 'completed_before' | 'already_released' | 'still_retryable' }

export function freeReleaseDecision(row: FreeReleaseFields): FreeReleaseDecision {
  if (row.entitlement_source !== 'free') return { release: false, reason: 'not_free' }
  if (!row.user_id) return { release: false, reason: 'guest' }
  if (row.status !== 'failed') return { release: false, reason: 'not_failed' }
  if (row.usage_counted === true) return { release: false, reason: 'completed_before' }
  if (row.entitlement_released_at) return { release: false, reason: 'already_released' }
  const eligibility = checkRetryEligibility({
    failureCode: row.failure_code ?? null,
    retryable: row.retryable ?? null,
    retryCount: row.retry_count ?? 0,
    retryAfter: null, // a backoff wait is not terminal
    isAdmin: false,
  })
  if (eligibility.eligible) return { release: false, reason: 'still_retryable' }
  return { release: true }
}

export interface FreeReleaseDb {
  rpc(fn: 'release_free_reservation', args: { p_request_id: string }): PromiseLike<{ data: unknown; error: unknown }>
}

/** Call from any place that observes a failed story. Safe to call repeatedly. */
export async function releaseFreeReservationIfTerminal(db: FreeReleaseDb, requestId: string, row: FreeReleaseFields): Promise<boolean> {
  const d = freeReleaseDecision(row)
  if (!d.release) return false
  const { data, error } = await db.rpc('release_free_reservation', { p_request_id: requestId })
  if (error) { console.error('[entitlements] release_free_reservation', requestId, error); return false }
  return data === true
}
