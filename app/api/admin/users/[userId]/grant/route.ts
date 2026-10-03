import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { AuthError, NotFoundError, ValidationError, toApiError } from '@/lib/utils/errors'
import { isPaidTier, periodAllowanceFor } from '@/lib/entitlements/policy'

// Complimentary entitlements (Entitlement Foundation).
//
// This is the deliberate replacement for the old Beta Mode bypass: testers
// and goodwill cases receive real, consumable entitlements that the submit
// route resolves exactly like a Stripe-backed one. Nothing here touches
// Stripe or money; `source` is recorded as 'admin'.
//
//   { kind: 'book',   tier: 'single'|'story_pack'|'story_pro', count?: 1..10, note? }
//     → N rows in story_purchases (one book each at that tier's capabilities)
//   { kind: 'period', tier: 'story_pack'|'story_pro', days?: 1..90, allowance?, note? }
//     → one subscription_periods row starting now
//
// Legacy plan labels are never converted automatically; an admin must grant.

const MAX_BOOKS = 10
const MAX_DAYS = 90

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { userId } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const kind = body.kind
    const tier = body.tier
    const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null

    if (!isPaidTier(tier)) throw new ValidationError('tier must be single, story_pack or story_pro')

    const supabase = createAdminClient()
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('id', userId).single()
    if (profileError || !profile) throw new NotFoundError('User')

    const grantedBy = adminCtx.userId

    if (kind === 'book') {
      const count = Math.min(MAX_BOOKS, Math.max(1, Number(body.count ?? 1) || 1))
      const rows = Array.from({ length: count }, () => ({
        user_id: userId, tier, status: 'paid', source: 'admin', granted_by: grantedBy, note,
      }))
      const { error } = await supabase.from('story_purchases').insert(rows)
      if (error) throw new ValidationError(`Grant failed: ${error.message}`)
      return NextResponse.json({ ok: true, kind, tier, count })
    }

    if (kind === 'period') {
      if (tier === 'single') throw new ValidationError('A period needs a subscription tier')
      const days = Math.min(MAX_DAYS, Math.max(1, Number(body.days ?? 30) || 30))
      const allowance = Math.max(0, Number(body.allowance ?? periodAllowanceFor(tier)) || periodAllowanceFor(tier))
      const start = new Date()
      const end = new Date(start.getTime() + days * 86_400_000)
      const { error } = await supabase.from('subscription_periods').insert({
        user_id: userId, plan_tier: tier, period_start: start.toISOString(), period_end: end.toISOString(),
        allowance, used: 0, source: 'admin', granted_by: grantedBy, note,
      })
      if (error) throw new ValidationError(`Grant failed: ${error.message}`)
      return NextResponse.json({ ok: true, kind, tier, allowance, periodEnd: end.toISOString() })
    }

    throw new ValidationError('kind must be book or period')
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
