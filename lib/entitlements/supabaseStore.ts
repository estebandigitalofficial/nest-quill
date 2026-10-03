// Server-only Supabase implementation of EntitlementStore.
//
// Every mutating method is one atomic statement (a SQL function from
// migration 20240068 or a conditional UPDATE), so concurrent submissions
// race at the database and exactly one wins the last unit.
//
// Never import from a client component.

import { createAdminClient } from '@/lib/supabase/admin'
import { reserveIdempotencyKey } from '@/lib/limits/idempotency'
import { isPaidTier, normalizeEmail, type PaidTier } from './policy'
import type { EntitlementStore, OpenPeriod, ProfileFacts } from './reserve'

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function supabaseEntitlementStore(): EntitlementStore {
  const db = createAdminClient()
  return {
    async getProfile(userId): Promise<ProfileFacts | null> {
      const { data } = await db.from('profiles').select('is_admin, free_books_used').eq('id', userId).maybeSingle()
      if (!data) return null
      const row = data as unknown as { is_admin: boolean | null; free_books_used: number | null }
      return { isAdmin: row.is_admin === true, freeBooksUsed: Number(row.free_books_used ?? 0) }
    },

    async countGuestFreeBooks(guestToken, email) {
      // Normalized EXACT match inside SQL (lower(btrim())), never a pattern:
      // '%' and '_' in an address are literal. Legacy guest rows (NULL
      // entitlement_source) still count.
      const { data, error } = await db.rpc('count_guest_free_books', { p_guest_token: guestToken, p_email: normalizeEmail(email) })
      if (error) { console.error('[entitlements] count_guest_free_books', error); return Number.MAX_SAFE_INTEGER }
      return Number(data ?? 0)
    },

    async reserveGuestSlot(guestToken) {
      // A 15-minute unique key on the token: the first concurrent caller
      // wins, the rest see a duplicate. The slot is released only when the
      // row insert fails; otherwise the created row itself is the record.
      const key = await sha256Hex(`guest-free:${guestToken}`)
      const hit = await reserveIdempotencyKey(key, 'guest_free')
      if (hit.isDuplicate) return { ok: false, slotId: null }
      return { ok: true, slotId: hit.keyRowId === null ? null : String(hit.keyRowId) }
    },

    async releaseGuestSlot(slotId) {
      if (!slotId) return
      await db.from('idempotency_keys').delete().eq('id', Number(slotId)).eq('scope', 'guest_free')
    },

    async reserveFreeBook(userId, limit) {
      const { data, error } = await db.rpc('reserve_free_book', { p_user_id: userId, p_limit: limit })
      if (error) { console.error('[entitlements] reserve_free_book', error); return false }
      return data === true
    },

    async releaseFreeBook(userId) {
      await db.rpc('release_free_book', { p_user_id: userId })
    },

    async findPaidPurchase(userId, tier) {
      const { data } = await db
        .from('story_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('tier', tier)
        .eq('status', 'paid')
        .is('request_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      return data ? { id: (data as { id: string }).id } : null
    },

    async reservePurchase(purchaseId, userId) {
      const { data, error } = await db.rpc('reserve_purchase', { p_purchase_id: purchaseId, p_user_id: userId })
      if (error) { console.error('[entitlements] reserve_purchase', error); return false }
      return data === true
    },

    async releasePurchase(purchaseId) {
      await db.rpc('release_purchase', { p_purchase_id: purchaseId })
    },

    async attachPurchaseRequest(purchaseId, requestId) {
      await db.from('story_purchases').update({ request_id: requestId }).eq('id', purchaseId).eq('status', 'consumed').is('request_id', null)
    },

    async findOpenPeriod(userId, nowIso): Promise<OpenPeriod | null> {
      const { data } = await db
        .from('subscription_periods')
        .select('id, plan_tier, allowance, used')
        .eq('user_id', userId)
        .lte('period_start', nowIso)
        .gt('period_end', nowIso)
        .order('period_end', { ascending: true })
        .limit(5)
      const rows = (data ?? []) as unknown as { id: string; plan_tier: string; allowance: number; used: number }[]
      const open = rows.find(r => r.used < r.allowance && isPaidTier(r.plan_tier))
      if (!open) return null
      return { id: open.id, planTier: open.plan_tier as PaidTier, allowance: open.allowance, used: open.used }
    },

    async reservePeriodUnit(periodId, userId) {
      const { data, error } = await db.rpc('reserve_subscription_unit', { p_period_id: periodId, p_user_id: userId })
      if (error) { console.error('[entitlements] reserve_subscription_unit', error); return false }
      return data === true
    },

    async releasePeriodUnit(periodId) {
      await db.rpc('release_subscription_unit', { p_period_id: periodId })
    },
  }
}
