// Pure scheduling / gating rules for the process-story worker.
//
// No Deno or Supabase imports here on purpose: this module is imported by the
// Edge Function (Deno) and exercised by plain Node tests
// (policy.test.ts via `node --experimental-strip-types --test`).

/** Statuses a fresh invocation may claim when the row has no live lease. */
export const CLAIMABLE_STATUSES: readonly string[] = ['queued', 'failed', 'generating_text', 'generating_images']

/**
 * Rows younger than this are left alone by the sweep so we never race a
 * worker that released / claimed a row seconds ago, or a continuation
 * invocation that is still being accepted.
 */
export const SWEEP_GRACE_MS = 45_000

/**
 * A row in a processing status with no progress for this long is failed by
 * the sweep (retryable, EDGE_FUNCTION_TIMEOUT) instead of being re-dispatched
 * forever. Every successful image bumps updated_at, so a slow-but-progressing
 * book never trips this.
 */
export const SWEEP_STALE_MS = 30 * 60_000

export interface ImageGate {
  /** SKIP_IMAGE_GENERATION worker secret. */
  skipEnv: boolean
  /** app_settings.image_generation_enabled (missing row = true). */
  imageGenEnabled: boolean
}

/**
 * Whether illustration generation is skipped for this run.
 * beta_mode_enabled is intentionally NOT an input: beta affects limits and
 * messaging only, never whether the product draws its pages.
 */
export function shouldSkipImages(gate: ImageGate): { skip: boolean; reason: string | null } {
  if (!gate.imageGenEnabled) return { skip: true, reason: 'image_generation_enabled=false' }
  if (gate.skipEnv) return { skip: true, reason: 'SKIP_IMAGE_GENERATION=true' }
  return { skip: false, reason: null }
}

export interface SweepRow {
  status: string
  worker_id: string | null
  worker_lease_expires_at: string | null
  updated_at: string
}

/** Lease is absent or has expired as of `nowMs`. */
export function leaseIsFree(row: Pick<SweepRow, 'worker_id' | 'worker_lease_expires_at'>, nowMs: number): boolean {
  if (row.worker_id === null) return true
  if (!row.worker_lease_expires_at) return true // worker set but no lease stamp (pre-20240056 row)
  return new Date(row.worker_lease_expires_at).getTime() < nowMs
}

/**
 * Sweep may re-dispatch this row: it is in a resumable status, nobody holds
 * a live lease, and it has been untouched for at least the grace window.
 */
export function isSweepEligible(row: SweepRow, nowMs: number, graceMs = SWEEP_GRACE_MS): boolean {
  if (!['queued', 'generating_text', 'generating_images'].includes(row.status)) return false
  if (nowMs - new Date(row.updated_at).getTime() < graceMs) return false
  return leaseIsFree(row, nowMs)
}

/** Sweep should fail this row instead of re-dispatching it. */
export function isSweepStale(row: SweepRow, nowMs: number, staleMs = SWEEP_STALE_MS): boolean {
  if (!['queued', 'generating_text', 'generating_images'].includes(row.status)) return false
  return nowMs - new Date(row.updated_at).getTime() >= staleMs
}

// ── Wall-clock budget ────────────────────────────────────────────────────────

/** Supabase Edge Function hard wall-clock limit (ms). */
export const HARD_LIMIT_MS = 150_000

/**
 * Stop starting new expensive calls this far into an invocation. 40 s of
 * headroom before HARD_LIMIT_MS covers one in-flight image call plus the
 * release + self-dispatch that follows.
 */
export const TIME_BUDGET_MS = 110_000

/** Conservative estimate of one image call when none has been measured yet. */
export const IMAGE_CALL_ESTIMATE_MS = 30_000

/** Headroom kept after the projected end of the cover call. */
export const COVER_SAFETY_MARGIN_MS = 5_000

/**
 * Whether the cover call may start now. Uses the longest image call measured
 * in THIS invocation (or the estimate when nothing was measured) so a slow
 * DALL-E day never starts a cover that the hard limit would kill.
 */
export function coverStartAllowed(
  elapsedMs: number,
  longestImageMs: number | null,
  budgetMs = TIME_BUDGET_MS,
  hardLimitMs = HARD_LIMIT_MS,
): { allowed: boolean; reason: 'ok' | 'budget' | 'projected_overrun'; projected_ms: number } {
  const expected = Math.max(longestImageMs ?? 0, IMAGE_CALL_ESTIMATE_MS)
  const projected = elapsedMs + expected + COVER_SAFETY_MARGIN_MS
  if (elapsedMs >= budgetMs) return { allowed: false, reason: 'budget', projected_ms: projected }
  if (projected > hardLimitMs) return { allowed: false, reason: 'projected_overrun', projected_ms: projected }
  return { allowed: true, reason: 'ok', projected_ms: projected }
}

// ── Bearer authorization ─────────────────────────────────────────────────────

/** Extract the bearer token from an Authorization header value. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(header)
  return m ? m[1] : null
}

/**
 * Application-level authorization for EVERY invocation mode of the worker
 * (standard, continue, images_only, sweep). The gateway's JWT check is
 * disabled for this function (supabase/config.toml), so this is the only
 * gate: it refuses when no expected token is configured, when the header
 * is missing or malformed, and when the token differs. Comparison is
 * constant-time over the longer of the two strings.
 */
export function isAuthorizedBearer(header: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected) return false
  const token = bearerToken(header)
  if (!token) return false
  const len = Math.max(token.length, expected.length)
  let diff = token.length ^ expected.length
  for (let i = 0; i < len; i++) {
    diff |= (token.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
  }
  return diff === 0
}

// ── Self-dispatch ────────────────────────────────────────────────────────────

/**
 * How long a dispatcher waits for the chained request to be accepted. The
 * child invocation runs to completion on its own; the parent only needs the
 * request to have left this isolate. The sweep covers a lost dispatch.
 */
export const DISPATCH_WAIT_MS = 3_000

export interface DispatchOutcome {
  /** True when the request was accepted (2xx) or is still in flight at the deadline. */
  ok: boolean
  outcome: 'accepted' | 'rejected' | 'error' | 'timeout'
  status?: number
  error?: string
}

/**
 * Race the dispatch response against a bounded wait. The SAME promise is
 * what the caller hands to EdgeRuntime.waitUntil, so the parent isolate is
 * kept alive for at most `waitMs` — never for the child's processing run.
 */
export function raceDispatch(
  response: Promise<{ ok: boolean; status: number }>,
  waitMs: number,
  sleepFn: (ms: number) => Promise<void>,
): Promise<DispatchOutcome> {
  return Promise.race([
    response
      .then(r => (r.ok
        ? { ok: true, outcome: 'accepted' as const, status: r.status }
        : { ok: false, outcome: 'rejected' as const, status: r.status }))
      .catch((e: unknown) => ({ ok: false, outcome: 'error' as const, error: e instanceof Error ? e.message : String(e) })),
    sleepFn(waitMs).then(() => ({ ok: true, outcome: 'timeout' as const, status: 0 })),
  ])
}

// ── Lease ownership ──────────────────────────────────────────────────────────

/** Lease held by the images-only backfill on a complete story. */
export const BACKFILL_LEASE_MS = 2 * 60_000

/** Only the worker whose id is on the row may release or mutate under it. */
export function ownsLease(row: Pick<SweepRow, 'worker_id'> | null | undefined, workerId: string): boolean {
  return !!row && row.worker_id === workerId
}

// ── Progress ─────────────────────────────────────────────────────────────────

/** A resumed worker never moves the visible progress backwards. */
export function monotonicProgress(previous: number | null | undefined, next: number): number {
  const prev = typeof previous === 'number' && Number.isFinite(previous) ? previous : 0
  return Math.max(prev, next)
}

// ── Ready-email recovery (sweep) ─────────────────────────────────────────────

/** Only stories completed within this window are considered. */
export const READY_EMAIL_RECOVERY_WINDOW_MS = 24 * 60 * 60_000
/** Give the worker's own completion callback this long before recovering. */
export const READY_EMAIL_RECOVERY_GRACE_MS = 2 * 60_000
/** Stop retrying after this many failed sends (visible in delivery_logs). */
export const READY_EMAIL_MAX_FAILED = 3

export interface CompletedRow {
  id: string
  completed_at: string | null
  user_email: string | null
}

export interface DeliveryLogRow {
  request_id: string
  channel: string
  status: string
  email_type: string | null
}

/**
 * Complete stories whose customer has not received a ready email and whose
 * failed attempts are below the cap. The callback the sweep then invokes
 * is itself idempotent (delivery_logs check + one-shot claim), so this
 * never produces a duplicate successful email.
 */
export function readyEmailRecoveryCandidates(rows: CompletedRow[], logs: DeliveryLogRow[], nowMs: number): string[] {
  const sent = new Set<string>()
  const failed = new Map<string, number>()
  for (const l of logs) {
    if (l.channel !== 'email' || l.email_type !== null) continue
    if (l.status === 'sent' || l.status === 'delivered') sent.add(l.request_id)
    else if (l.status === 'failed') failed.set(l.request_id, (failed.get(l.request_id) ?? 0) + 1)
  }
  const out: string[] = []
  for (const r of rows) {
    if (!r.user_email || !r.completed_at) continue
    const age = nowMs - new Date(r.completed_at).getTime()
    if (age < READY_EMAIL_RECOVERY_GRACE_MS || age > READY_EMAIL_RECOVERY_WINDOW_MS) continue
    if (sent.has(r.id)) continue
    if ((failed.get(r.id) ?? 0) >= READY_EMAIL_MAX_FAILED) continue
    out.push(r.id)
  }
  return out
}
