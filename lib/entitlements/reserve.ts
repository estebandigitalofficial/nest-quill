/**
 * ENTITLEMENT RESERVATION — orchestration over an abstract store.
 *
 * Pure except for the store calls, so the whole flow is testable with the
 * in-memory store below. The Supabase store (supabaseStore.ts) maps every
 * method onto one atomic statement or SQL function, which is what makes
 * two simultaneous submissions unable to both take the last book.
 *
 * Order of operations in the submit route:
 *   validate → identity → rate limits → submission idempotency →
 *   reserveEntitlement() → applyCaps → INSERT story_requests →
 *   reservation.attach(requestId)   (or reservation.undo() if the insert fails)
 *
 * Retry, force requeue, sweep recovery and image backfill never pass through
 * here: they operate on an existing row and therefore never reserve again.
 */

import {
  applyCaps, deny, isPaidTier, TIER_CAPS,
  type CapsResult, type Decision, type Denial, type LaunchTier, type PaidTier, type SubmissionShape,
} from './policy.ts'

export interface ProfileFacts {
  isAdmin: boolean
  freeBooksUsed: number
}

export interface OpenPeriod {
  id: string
  planTier: PaidTier
  allowance: number
  used: number
}

export interface EntitlementStore {
  getProfile(userId: string): Promise<ProfileFacts | null>
  /** Non-failed Free books already made by this guest (token OR email). */
  countGuestFreeBooks(guestToken: string, email: string | null): Promise<number>
  /** Short-lived unique slot so two concurrent guest submissions get one winner. */
  reserveGuestSlot(guestToken: string): Promise<{ ok: boolean; slotId: string | null }>
  releaseGuestSlot(slotId: string | null): Promise<void>
  reserveFreeBook(userId: string, limit: number): Promise<boolean>
  releaseFreeBook(userId: string): Promise<void>
  findPaidPurchase(userId: string, tier: PaidTier): Promise<{ id: string } | null>
  reservePurchase(purchaseId: string, userId: string): Promise<boolean>
  releasePurchase(purchaseId: string): Promise<void>
  attachPurchaseRequest(purchaseId: string, requestId: string): Promise<void>
  findOpenPeriod(userId: string, nowIso: string): Promise<OpenPeriod | null>
  reservePeriodUnit(periodId: string, userId: string): Promise<boolean>
  releasePeriodUnit(periodId: string): Promise<void>
}

export interface ReserveContext {
  userId: string | null
  guestToken: string | null
  email: string | null
  /** Client intent — never authorization. */
  intent: LaunchTier
  submission: SubmissionShape
  limits: { freeLifetime: number; freeGuest: number }
  nowIso?: string
}

export interface Reservation {
  decision: Decision
  caps: Extract<CapsResult, { ok: true }>
  /** Link the consumed entitlement to the row that was created. */
  attach(requestId: string): Promise<void>
  /** Compensation only: the row could not be created, so give the unit back. */
  undo(): Promise<void>
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; denial: Denial | { code: 'STYLE_NOT_ALLOWED'; status: 400; message: string } }

export async function reserveEntitlement(store: EntitlementStore, ctx: ReserveContext): Promise<ReserveResult> {
  const nowIso = ctx.nowIso ?? new Date().toISOString()

  // ── Guests: Free only, one book per guest ───────────────────────────────
  if (!ctx.userId) {
    if (ctx.intent !== 'free') return { ok: false, denial: deny('ACCOUNT_REQUIRED') }
    if (!ctx.guestToken) return { ok: false, denial: deny('ACCOUNT_REQUIRED') }
    const caps = applyCaps('free', ctx.submission)
    if (!caps.ok) return { ok: false, denial: { code: 'STYLE_NOT_ALLOWED', status: 400, message: caps.message } }
    const made = await store.countGuestFreeBooks(ctx.guestToken, ctx.email)
    if (made >= ctx.limits.freeGuest) return { ok: false, denial: deny('GUEST_LIMIT_EXCEEDED') }
    const slot = await store.reserveGuestSlot(ctx.guestToken)
    if (!slot.ok) return { ok: false, denial: deny('GUEST_LIMIT_EXCEEDED') }
    return {
      ok: true,
      reservation: {
        decision: { source: 'free', tier: 'free', ref: null },
        caps,
        attach: async () => {},
        undo: () => store.releaseGuestSlot(slot.slotId),
      },
    }
  }

  const profile = await store.getProfile(ctx.userId)
  if (!profile) return { ok: false, denial: deny('ENTITLEMENT_REQUIRED') }

  // ── Admins: no reservation, caps of the requested tier ──────────────────
  if (profile.isAdmin) {
    const caps = applyCaps(ctx.intent, ctx.submission)
    if (!caps.ok) return { ok: false, denial: { code: 'STYLE_NOT_ALLOWED', status: 400, message: caps.message } }
    return { ok: true, reservation: { decision: { source: 'admin', tier: ctx.intent, ref: null }, caps, attach: async () => {}, undo: async () => {} } }
  }

  // ── Free: lifetime counter on the profile ───────────────────────────────
  if (ctx.intent === 'free') {
    const caps = applyCaps('free', ctx.submission)
    if (!caps.ok) return { ok: false, denial: { code: 'STYLE_NOT_ALLOWED', status: 400, message: caps.message } }
    if (profile.freeBooksUsed >= ctx.limits.freeLifetime) return { ok: false, denial: deny('PLAN_LIMIT_EXCEEDED') }
    const got = await store.reserveFreeBook(ctx.userId, ctx.limits.freeLifetime)
    if (!got) return { ok: false, denial: deny('PLAN_LIMIT_EXCEEDED') }
    const userId = ctx.userId
    return {
      ok: true,
      reservation: {
        decision: { source: 'free', tier: 'free', ref: null },
        caps,
        attach: async () => {},
        undo: () => store.releaseFreeBook(userId),
      },
    }
  }

  // ── Paid intent: a matching purchase first, then an open subscription ──
  if (!isPaidTier(ctx.intent)) return { ok: false, denial: deny('ENTITLEMENT_REQUIRED') }
  const userId = ctx.userId

  const purchase = await store.findPaidPurchase(userId, ctx.intent)
  if (purchase) {
    const caps = applyCaps(ctx.intent, ctx.submission)
    if (!caps.ok) return { ok: false, denial: { code: 'STYLE_NOT_ALLOWED', status: 400, message: caps.message } }
    const got = await store.reservePurchase(purchase.id, userId)
    if (got) {
      return {
        ok: true,
        reservation: {
          decision: { source: 'purchase', tier: ctx.intent, ref: purchase.id },
          caps,
          attach: (requestId) => store.attachPurchaseRequest(purchase.id, requestId),
          undo: () => store.releasePurchase(purchase.id),
        },
      }
    }
    // Lost the race for that purchase; fall through to a subscription if any.
  }

  const period = await store.findOpenPeriod(userId, nowIso)
  if (period && period.used < period.allowance) {
    const caps = applyCaps(period.planTier, ctx.submission)
    if (!caps.ok) return { ok: false, denial: { code: 'STYLE_NOT_ALLOWED', status: 400, message: caps.message } }
    const got = await store.reservePeriodUnit(period.id, userId)
    if (got) {
      return {
        ok: true,
        reservation: {
          decision: { source: 'subscription', tier: period.planTier, ref: period.id },
          caps,
          attach: async () => {},
          undo: () => store.releasePeriodUnit(period.id),
        },
      }
    }
  }

  return { ok: false, denial: deny('ENTITLEMENT_REQUIRED') }
}

/** Caps a resolved tier grants; exported for admin/reporting surfaces. */
export function capsForTier(tier: LaunchTier) {
  return TIER_CAPS[tier]
}

// ── In-memory store (tests and local reasoning) ─────────────────────────────

export interface MemoryState {
  profiles: Map<string, { isAdmin: boolean; freeBooksUsed: number }>
  guestBooks: { token: string; email: string | null; failed: boolean }[]
  guestSlots: Set<string>
  purchases: Map<string, { userId: string; tier: PaidTier; status: 'paid' | 'consumed' | 'refunded' | 'revoked'; requestId: string | null }>
  periods: Map<string, { userId: string; planTier: PaidTier; allowance: number; used: number; start: string; end: string }>
}

export function memoryEntitlementStore(state: MemoryState): EntitlementStore {
  return {
    async getProfile(userId) { return state.profiles.get(userId) ?? null },
    async countGuestFreeBooks(token, email) {
      const e = email?.toLowerCase().trim() ?? null
      return state.guestBooks.filter(b => !b.failed && (b.token === token || (e !== null && b.email === e))).length
    },
    async reserveGuestSlot(token) {
      if (state.guestSlots.has(token)) return { ok: false, slotId: null }
      state.guestSlots.add(token)
      return { ok: true, slotId: token }
    },
    async releaseGuestSlot(slotId) { if (slotId) state.guestSlots.delete(slotId) },
    async reserveFreeBook(userId, limit) {
      const p = state.profiles.get(userId)
      if (!p || p.freeBooksUsed >= limit) return false
      p.freeBooksUsed += 1
      return true
    },
    async releaseFreeBook(userId) {
      const p = state.profiles.get(userId)
      if (p && p.freeBooksUsed > 0) p.freeBooksUsed -= 1
    },
    async findPaidPurchase(userId, tier) {
      for (const [id, p] of state.purchases) if (p.userId === userId && p.tier === tier && p.status === 'paid') return { id }
      return null
    },
    async reservePurchase(id, userId) {
      const p = state.purchases.get(id)
      if (!p || p.userId !== userId || p.status !== 'paid') return false
      p.status = 'consumed'
      return true
    },
    async releasePurchase(id) {
      const p = state.purchases.get(id)
      if (p && p.status === 'consumed' && p.requestId === null) p.status = 'paid'
    },
    async attachPurchaseRequest(id, requestId) {
      const p = state.purchases.get(id)
      if (p && p.status === 'consumed' && p.requestId === null) p.requestId = requestId
    },
    async findOpenPeriod(userId, nowIso) {
      for (const [id, p] of state.periods) {
        if (p.userId === userId && p.start <= nowIso && nowIso < p.end && p.used < p.allowance) {
          return { id, planTier: p.planTier, allowance: p.allowance, used: p.used }
        }
      }
      return null
    },
    async reservePeriodUnit(id, userId) {
      const p = state.periods.get(id)
      if (!p || p.userId !== userId || p.used >= p.allowance) return false
      p.used += 1
      return true
    },
    async releasePeriodUnit(id) {
      const p = state.periods.get(id)
      if (p && p.used > 0) p.used -= 1
    },
  }
}

export function emptyMemoryState(): MemoryState {
  return { profiles: new Map(), guestBooks: [], guestSlots: new Set(), purchases: new Map(), periods: new Map() }
}
