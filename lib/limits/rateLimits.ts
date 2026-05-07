// Server-only rate limits + queue pressure for the public beta.
//
// Counts come from existing tables (story_requests, support_tickets)
// so we don't write a row per request; only blocked attempts are
// logged into rate_limit_events for admin metrics. Admin users
// always bypass.
//
// Soft-throttle ladder for stories:
//   1. rate-limit hits (per identifier per window) → 429
//   2. queue critical (system-wide active jobs) → 503
//   3. queue warning → guests blocked, signed-in pass with banner
//
// Never import from a client component.

import { createAdminClient } from '@/lib/supabase/admin'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS  = 24 * 60 * 60 * 1000

// Beta limits — generous enough that real users don't hit them, tight
// enough to absorb a viral burst.
export const STORY_LIMITS = {
  guest:  { hour: 3,  day: 10 },
  auth:   { hour: 10, day: 30 },
} as const

export const SUPPORT_LIMITS = {
  guest:  { day: 3 },
  auth:   { day: 10 },
} as const

// Queue pressure thresholds — total of (queued | generating_text |
// generating_images | assembling_pdf) at the moment of submission.
export const QUEUE_THRESHOLDS = {
  warning:  25,
  critical: 50,
} as const

const ACTIVE_STATUSES = ['queued', 'generating_text', 'generating_images', 'assembling_pdf']

// ── Result shape ─────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  /** Suggested wait in seconds before retrying. */
  retryAfterSeconds?: number
  /** User-friendly explanation. */
  message?: string
  /** Stable code for the client. */
  code?: string
}

export type QueuePressure = 'normal' | 'warning' | 'critical'

// ── Story submission ────────────────────────────────────────────────

interface StoryRateLimitArgs {
  userId: string | null
  /** Lowercased email used to identify a guest across requests. */
  guestEmail: string | null
  ipHash: string | null
  isAdmin: boolean
}

export async function checkStoryRateLimit(args: StoryRateLimitArgs): Promise<RateLimitResult> {
  if (args.isAdmin) return { allowed: true }
  const db = createAdminClient()
  const now = Date.now()

  if (args.userId) {
    const [{ count: hour }, { count: day }] = await Promise.all([
      db.from('story_requests').select('id', { count: 'exact', head: true })
        .eq('user_id', args.userId).gte('created_at', new Date(now - HOUR_MS).toISOString()),
      db.from('story_requests').select('id', { count: 'exact', head: true })
        .eq('user_id', args.userId).gte('created_at', new Date(now - DAY_MS).toISOString()),
    ])
    if ((hour ?? 0) >= STORY_LIMITS.auth.hour) {
      await logBlock('story_submit', 'hour', { user_id: args.userId, ip_hash: args.ipHash })
      return rateLimit('hourly', 'You\'ve created several stories in the last hour. Try again in a bit.', 'STORY_RATE_HOUR', HOUR_MS / 1000)
    }
    if ((day ?? 0) >= STORY_LIMITS.auth.day) {
      await logBlock('story_submit', 'day', { user_id: args.userId, ip_hash: args.ipHash })
      return rateLimit('daily', 'Daily story limit reached. Try again tomorrow.', 'STORY_RATE_DAY', DAY_MS / 1000)
    }
    return { allowed: true }
  }

  // Guests — identify by lowercased email. Without an email we can't
  // throttle reliably; fall through (the route validates email anyway).
  const email = args.guestEmail?.toLowerCase().trim()
  if (!email) return { allowed: true }

  const [{ count: hour }, { count: day }] = await Promise.all([
    db.from('story_requests').select('id', { count: 'exact', head: true })
      .is('user_id', null).ilike('user_email', email).gte('created_at', new Date(now - HOUR_MS).toISOString()),
    db.from('story_requests').select('id', { count: 'exact', head: true })
      .is('user_id', null).ilike('user_email', email).gte('created_at', new Date(now - DAY_MS).toISOString()),
  ])
  if ((hour ?? 0) >= STORY_LIMITS.guest.hour) {
    await logBlock('story_submit', 'hour', { email, ip_hash: args.ipHash })
    return rateLimit('hourly', 'You\'ve sent in a few stories already. Sign up to lift the limit, or try again in an hour.', 'STORY_RATE_HOUR_GUEST', HOUR_MS / 1000)
  }
  if ((day ?? 0) >= STORY_LIMITS.guest.day) {
    await logBlock('story_submit', 'day', { email, ip_hash: args.ipHash })
    return rateLimit('daily', 'Daily guest limit reached. Sign up for a free account to keep going.', 'STORY_RATE_DAY_GUEST', DAY_MS / 1000)
  }
  return { allowed: true }
}

// ── Support tickets ─────────────────────────────────────────────────

interface SupportRateLimitArgs {
  userId: string | null
  /** Lowercased email. */
  email: string | null
  ipHash: string | null
  isAdmin: boolean
}

export async function checkSupportRateLimit(args: SupportRateLimitArgs): Promise<RateLimitResult> {
  if (args.isAdmin) return { allowed: true }
  const db = createAdminClient()
  const now = Date.now()
  const since = new Date(now - DAY_MS).toISOString()

  if (args.userId) {
    const { count } = await db.from('support_tickets').select('id', { count: 'exact', head: true })
      .eq('user_id', args.userId).gte('created_at', since)
    if ((count ?? 0) >= SUPPORT_LIMITS.auth.day) {
      await logBlock('support_ticket', 'day', { user_id: args.userId, ip_hash: args.ipHash })
      return rateLimit('daily', 'You\'ve sent several messages today. We\'ll get back to you — please hold off on more for now.', 'SUPPORT_RATE_DAY', DAY_MS / 1000)
    }
    return { allowed: true }
  }

  const email = args.email?.toLowerCase().trim()
  if (!email) return { allowed: true }
  const { count } = await db.from('support_tickets').select('id', { count: 'exact', head: true })
    .ilike('email', email).gte('created_at', since)
  if ((count ?? 0) >= SUPPORT_LIMITS.guest.day) {
    await logBlock('support_ticket', 'day', { email, ip_hash: args.ipHash })
    return rateLimit('daily', 'Too many messages from this address today. Please wait a day or sign in to send more.', 'SUPPORT_RATE_DAY_GUEST', DAY_MS / 1000)
  }
  return { allowed: true }
}

// ── Queue pressure ──────────────────────────────────────────────────

export async function getQueuePressure(): Promise<{ level: QueuePressure; active: number }> {
  const db = createAdminClient()
  const { count } = await db
    .from('story_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ACTIVE_STATUSES)
  const active = count ?? 0
  const level: QueuePressure =
    active >= QUEUE_THRESHOLDS.critical ? 'critical' :
    active >= QUEUE_THRESHOLDS.warning  ? 'warning'  : 'normal'
  return { level, active }
}

/**
 * Returns a block when queue pressure should reject this submission.
 * Critical → block everyone except admins. Warning → block guests.
 * Authenticated users see a "high demand" banner on /create instead of
 * a hard block.
 */
export async function checkQueueGate(args: { isGuest: boolean; isAdmin: boolean; ipHash: string | null; email: string | null; userId: string | null }): Promise<RateLimitResult> {
  if (args.isAdmin) return { allowed: true }
  const { level, active } = await getQueuePressure()
  if (level === 'critical') {
    await logBlock('queue_critical', `active=${active}`, { user_id: args.userId, email: args.email, ip_hash: args.ipHash })
    return {
      allowed: false,
      retryAfterSeconds: 5 * 60,
      message: 'The story queue is at capacity. Please try again in a few minutes.',
      code: 'QUEUE_CRITICAL',
    }
  }
  if (level === 'warning' && args.isGuest) {
    await logBlock('queue_warning', `active=${active}`, { email: args.email, ip_hash: args.ipHash })
    return {
      allowed: false,
      retryAfterSeconds: 5 * 60,
      message: 'High demand right now — sign up for an account to skip the line, or try again shortly.',
      code: 'QUEUE_WARNING_GUEST',
    }
  }
  return { allowed: true }
}

// ── Helpers ─────────────────────────────────────────────────────────

function rateLimit(_reason: string, message: string, code: string, retryAfterSeconds: number): RateLimitResult {
  return { allowed: false, message, code, retryAfterSeconds }
}

interface LogContext {
  user_id?: string | null
  email?: string | null
  ip_hash?: string | null
}

async function logBlock(action: string, reason: string, ctx: LogContext): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('rate_limit_events').insert({
      action,
      reason,
      user_id: ctx.user_id ?? null,
      email: ctx.email ?? null,
      ip_hash: ctx.ip_hash ?? null,
    })
  } catch {
    // Logging is best-effort. Never block enforcement on a log failure.
  }
}

/** Hash an IP for low-cardinality logging without storing the raw value. */
export async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null
  try {
    const buf = new TextEncoder().encode(ip)
    const digest = await crypto.subtle.digest('SHA-256', buf)
    const bytes = new Uint8Array(digest)
    return Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}
