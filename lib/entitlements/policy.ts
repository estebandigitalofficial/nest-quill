/**
 * ENTITLEMENT POLICY — pure, no I/O (Entitlement Foundation).
 *
 * The client may state an *intent* (which plan it would like). The server
 * resolves what the customer is actually entitled to and snapshots the
 * resulting capabilities onto the story request. Nothing in here reads
 * Beta Mode: beta is messaging, never authorization.
 *
 * Sources of entitlement:
 *   free          profiles.free_books_used < FREE_LIFETIME_BOOKS (guests: one
 *                 book per guest_token before an account exists)
 *   purchase      a story_purchases row (Stripe later, or an admin grant now)
 *   subscription  a subscription_periods row with capacity (Stripe later, or
 *                 an admin grant now)
 *   admin         the submitting user is an administrator
 *   legacy        rows written before this model (entitlement_source NULL)
 */

export const LAUNCH_TIERS = ['free', 'single', 'story_pack', 'story_pro'] as const
export type LaunchTier = (typeof LAUNCH_TIERS)[number]
export type PaidTier = Exclude<LaunchTier, 'free'>

export const ALL_LAUNCH_STYLES = ['watercolor', 'cartoon', 'storybook', 'pencil_sketch', 'digital_art'] as const
export const FREE_STYLES = ['watercolor'] as const

/** Founder decisions (2026-10-02). */
export const FREE_LIFETIME_BOOKS = 2
export const FREE_GUEST_BOOKS = 1
export const STORY_LENGTH_OPTIONS = [8, 16, 24, 32] as const

export interface TierCaps {
  maxPages: 8 | 16 | 24 | 32
  styles: readonly string[]
  dedication: boolean
  pdf: boolean
  /** Books per billing period for subscriptions; null for free/one-time. */
  periodAllowance: number | null
}

export const TIER_CAPS: Record<LaunchTier, TierCaps> = {
  free:       { maxPages: 8,  styles: FREE_STYLES,       dedication: false, pdf: false, periodAllowance: null },
  single:     { maxPages: 16, styles: ALL_LAUNCH_STYLES, dedication: true,  pdf: true,  periodAllowance: null },
  story_pack: { maxPages: 24, styles: ALL_LAUNCH_STYLES, dedication: true,  pdf: true,  periodAllowance: 3 },
  story_pro:  { maxPages: 32, styles: ALL_LAUNCH_STYLES, dedication: true,  pdf: true,  periodAllowance: 6 },
}

/** No rollover at launch: a new period starts with exactly the plan allowance. */
export function periodAllowanceFor(tier: PaidTier): number {
  const a = TIER_CAPS[tier].periodAllowance
  return a ?? 1
}

export function isLaunchTier(v: unknown): v is LaunchTier {
  return typeof v === 'string' && (LAUNCH_TIERS as readonly string[]).includes(v)
}

export function isPaidTier(v: unknown): v is PaidTier {
  return isLaunchTier(v) && v !== 'free'
}

// ── Applying caps to a submission ───────────────────────────────────────────

export interface SubmissionShape {
  storyLength: number
  illustrationStyle: string
  dedicationText?: string | null
}

export type CapsResult =
  | { ok: true; storyLength: 8 | 16 | 24 | 32; illustrationStyle: string; dedicationText: string | null; pdfEntitled: boolean }
  | { ok: false; code: 'STYLE_NOT_ALLOWED'; message: string }

/**
 * Pages are clamped silently (existing behaviour). A disallowed style is
 * rejected because silently swapping artwork would surprise the customer.
 * A dedication the tier does not include is dropped.
 */
export function applyCaps(tier: LaunchTier, s: SubmissionShape): CapsResult {
  const caps = TIER_CAPS[tier]
  if (!caps.styles.includes(s.illustrationStyle)) {
    return {
      ok: false,
      code: 'STYLE_NOT_ALLOWED',
      message: tier === 'free'
        ? 'The Free book uses the Watercolor style. Choose Watercolor, or pick a paid plan for other styles.'
        : 'That illustration style is not available on this plan.',
    }
  }
  const storyLength = clampPages(s.storyLength, caps.maxPages)
  const dedicationText = caps.dedication && s.dedicationText && s.dedicationText.trim().length > 0
    ? s.dedicationText
    : null
  return { ok: true, storyLength, illustrationStyle: s.illustrationStyle, dedicationText, pdfEntitled: caps.pdf }
}

export function clampPages(requested: number, max: 8 | 16 | 24 | 32): 8 | 16 | 24 | 32 {
  const allowed = STORY_LENGTH_OPTIONS.filter(n => n <= max)
  const pick = allowed.filter(n => n <= requested).pop() ?? allowed[0]
  return pick
}

// ── PDF authorization ───────────────────────────────────────────────────────

export interface PdfEntitlementFields {
  entitlement_source?: string | null
  pdf_entitled?: boolean | null
  plan_tier?: string | null
}

/**
 * Authoritative PDF rule.
 *   - Rows written under this model (entitlement_source set) use the snapshot.
 *   - Legacy rows (entitlement_source NULL) keep the behaviour they always had:
 *     any non-free label could download. This is the explicit compatibility
 *     rule; historical rows are never rewritten.
 */
export function pdfEntitledFor(row: PdfEntitlementFields): boolean {
  if (row.entitlement_source) return row.pdf_entitled === true
  return !!row.plan_tier && row.plan_tier !== 'free'
}

// ── Email normalization (mirrors lower(btrim()) in SQL) ─────────────────────

/** Trim and lower-case. Equality only — never a pattern; '%' and '_' stay literal. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== 'string') return null
  const n = email.trim().toLowerCase()
  return n.length > 0 ? n : null
}

export interface GuestRowLike {
  user_id?: string | null
  guest_token?: string | null
  user_email?: string | null
  status?: string | null
  plan_tier?: string | null
  entitlement_source?: string | null
}

/**
 * Pure mirror of claim_guest_stories_by_verified_email's predicate, used by
 * tests to pin the matching rules: only unowned guest rows, normalized exact
 * email equality, nothing when the auth provider has not verified the email.
 * Returns the rows that would be attached and how many Free books would count
 * (completed Free rows, capped).
 */
export function guestRowsClaimableByVerifiedEmail<T extends GuestRowLike>(
  rows: readonly T[],
  verifiedEmail: string | null | undefined,
  emailConfirmed: boolean,
  cap = FREE_GUEST_BOOKS,
): { rows: T[]; freeBooksCounted: number } {
  const target = normalizeEmail(verifiedEmail)
  if (!emailConfirmed || !target) return { rows: [], freeBooksCounted: 0 }
  const matched = rows.filter(r => !r.user_id && !!r.guest_token && normalizeEmail(r.user_email) === target)
  const completedFree = matched.filter(r => r.status === 'complete' && (r.entitlement_source === 'free' || (!r.entitlement_source && r.plan_tier === 'free'))).length
  return { rows: matched, freeBooksCounted: Math.min(cap, completedFree) }
}

// ── Resolution (pure decision given already-loaded facts) ───────────────────

export type EntitlementSource = 'free' | 'purchase' | 'subscription' | 'admin'

export interface Decision {
  source: EntitlementSource
  tier: LaunchTier
  /** story_purchases.id or subscription_periods.id; null for free/admin. */
  ref: string | null
}

export type Denial =
  | { code: 'ACCOUNT_REQUIRED'; status: 403; requiresSignup: true; message: string }
  | { code: 'GUEST_LIMIT_EXCEEDED'; status: 403; requiresSignup: true; message: string }
  | { code: 'PLAN_LIMIT_EXCEEDED'; status: 403; message: string }
  | { code: 'ENTITLEMENT_REQUIRED'; status: 402; message: string }

export function deny(code: Denial['code']): Denial {
  switch (code) {
    case 'ACCOUNT_REQUIRED':
      return { code, status: 403, requiresSignup: true, message: 'Create an account to use a paid plan. Your Free book does not need one.' }
    case 'GUEST_LIMIT_EXCEEDED':
      return { code, status: 403, requiresSignup: true, message: "You've used your free story. Create an account to continue." }
    case 'PLAN_LIMIT_EXCEEDED':
      return { code, status: 403, message: "You've used both of your free books. Choose a paid plan to keep creating." }
    case 'ENTITLEMENT_REQUIRED':
      return { code, status: 402, message: 'This plan is not active on your account yet. Paid plans will be available soon.' }
  }
}

/** Which plan a historical label would have implied — never an entitlement. */
export function legacyLabelGrantsEntitlement(_label: string | null | undefined): false {
  return false
}
