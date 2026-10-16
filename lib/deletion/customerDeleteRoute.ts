// 3C-3: HTTP contract for the customer "permanently delete my archived failed
// story" route, kept as a pure module so Node tests can drive it with fakes.
//
// The route handler (app/api/story/[requestId]/route.ts, DELETE) only wires
// the three dependencies below; everything else — the exposure gate, the
// fail-closed auth order, requestId validation and the outcome → HTTP mapping
// — lives here. Destructive work stays in the 3C-2 service: this module never
// touches story rows, deletion_log, storage or the 20240074/20240075 SQL
// functions, and never duplicates their eligibility rules (archived, failed,
// no worker, quiescent, owned by the caller). Those are checked once, under
// the database row lock, inside delete_failed_story.
//
// Exposure gate (3C-8 legal update not yet live): the route answers the
// generic 404 to EVERY caller unless the app_settings key
// `customer_story_deletion_enabled` is boolean true. The key has no row today
// and the reader falls back to false, so a deployment of this code exposes
// nothing; enabling it later is one app_settings row, no code change.
//
// Privacy: unknown id, malformed id, another customer's story and "the flag
// is off" all share one 404 body. Nothing from the service's failure detail
// (storage paths, deletion_log ids, SQL text, Supabase errors) reaches the
// response; logs carry outcome class, status, request id and a bare failure
// code only.

import { assertServerOnly, type DeleteFailedStoryResult } from './deleteFailedStory.ts'
import { normalizeRequestId } from './storagePaths.ts'

/** app_settings key read with fallback false: no row (today) means OFF. */
export const CUSTOMER_DELETION_FLAG_KEY = 'customer_story_deletion_enabled'

export type CustomerDeleteOutcome =
  | 'disabled'
  | 'unauthenticated'
  | 'malformed_id'
  | 'not_found'
  | 'not_eligible'
  | 'deleted'
  | 'already_deleted'
  | 'cleanup_pending'
  | 'rpc_failed'
  | 'error'

export interface CustomerDeleteResponse {
  status: number
  body: Record<string, unknown>
  outcome: CustomerDeleteOutcome
}

export interface CustomerDeleteLogEntry {
  outcome: CustomerDeleteOutcome
  status: number
  /** Normalised request id (an opaque UUID) when the id parsed, else null. */
  requestId: string | null
  /** Bare machine code from the service (e.g. storage_list_failed); never its detail. */
  failureCode?: string
}

export interface CustomerDeleteDeps {
  /** Exposure gate; any throw is treated as OFF. */
  isEnabled(): Promise<boolean>
  /** Session user id from the Supabase cookie session, or null. The ONLY source of userId. */
  getUserId(): Promise<string | null>
  /** The 3C-2 service bound to a service-role client. */
  deleteStory(input: { requestId: string; userId: string }): Promise<DeleteFailedStoryResult>
  log?(entry: CustomerDeleteLogEntry): void
}

// ── Response bodies ──────────────────────────────────────────
// Error shape follows lib/utils/errors toApiError: { message, code }.
// Success shape follows the archive/restore routes: { ok: true, ... }.
const NOT_FOUND_BODY = { message: 'Story not found', code: 'NOT_FOUND' } as const
const UNAUTHORIZED_BODY = { message: 'Unauthorized' } as const
const NOT_ELIGIBLE_BODY = {
  message: 'This story is not currently eligible for permanent deletion.',
  code: 'NOT_ELIGIBLE',
} as const
const INTERNAL_BODY = { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' } as const
/** Same body for a fresh completion and for a repeated DELETE (already_deleted). */
const DELETED_BODY = { ok: true, state: 'deleted' } as const
const CLEANUP_PENDING_BODY = {
  ok: true,
  state: 'cleanup_pending',
  message: 'Deletion has begun. Remaining cleanup finishes automatically.',
} as const

export function responseFor(outcome: CustomerDeleteOutcome): CustomerDeleteResponse {
  switch (outcome) {
    case 'disabled':
    case 'malformed_id':
    case 'not_found':
      return { status: 404, body: { ...NOT_FOUND_BODY }, outcome }
    case 'unauthenticated':
      return { status: 401, body: { ...UNAUTHORIZED_BODY }, outcome }
    case 'not_eligible':
      return { status: 409, body: { ...NOT_ELIGIBLE_BODY }, outcome }
    case 'deleted':
    case 'already_deleted':
      return { status: 200, body: { ...DELETED_BODY }, outcome }
    case 'cleanup_pending':
      return { status: 202, body: { ...CLEANUP_PENDING_BODY }, outcome }
    case 'rpc_failed':
    case 'error':
      return { status: 500, body: { ...INTERNAL_BODY }, outcome }
  }
}

/** Service outcome → route outcome class. Pure; the only place the mapping lives. */
export function classifyServiceResult(result: DeleteFailedStoryResult): { outcome: CustomerDeleteOutcome; failureCode?: string } {
  switch (result.outcome) {
    case 'not_found':
      return { outcome: 'not_found' }
    case 'not_eligible':
      return { outcome: 'not_eligible' }
    case 'deleted':
      return { outcome: result.completedNow ? 'deleted' : 'already_deleted' }
    case 'incomplete':
      return { outcome: 'cleanup_pending', failureCode: result.failureCode }
    case 'rpc_failed':
      return { outcome: 'rpc_failed', failureCode: result.failureCode }
  }
}

/**
 * Order is deliberate and fail-closed: gate → auth → id syntax → service.
 * The gate runs first so an OFF deployment reveals nothing, not even that the
 * handler exists behind a 401. The service is called exactly once per request
 * and only with the session user id; retries and concurrent calls are made
 * safe by the service/database (already_deleted, row lock, status-guarded
 * completion), not by anything here.
 */
export async function handleCustomerStoryDelete(deps: CustomerDeleteDeps, rawRequestId: unknown): Promise<CustomerDeleteResponse> {
  assertServerOnly()
  const requestId = normalizeRequestId(rawRequestId)
  const finish = (outcome: CustomerDeleteOutcome, failureCode?: string): CustomerDeleteResponse => {
    const res = responseFor(outcome)
    try {
      deps.log?.({ outcome, status: res.status, requestId, ...(failureCode ? { failureCode } : {}) })
    } catch {
      // logging must never change the response
    }
    return res
  }

  let enabled = false
  try {
    enabled = (await deps.isEnabled()) === true
  } catch {
    enabled = false
  }
  if (!enabled) return finish('disabled')

  try {
    const userId = await deps.getUserId()
    if (!userId) return finish('unauthenticated')
    if (!requestId) return finish('malformed_id')

    const result = await deps.deleteStory({ requestId, userId })
    const { outcome, failureCode } = classifyServiceResult(result)
    return finish(outcome, failureCode)
  } catch {
    return finish('error')
  }
}
