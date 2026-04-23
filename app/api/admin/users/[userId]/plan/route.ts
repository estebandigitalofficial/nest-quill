import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { getPlanLimits } from '@/lib/plans/config'
import { AuthError, NotFoundError, ValidationError, toApiError } from '@/lib/utils/errors'
import type { PlanTier } from '@/types/database'

const VALID_TIERS: PlanTier[] = ['free', 'single', 'story_pack', 'story_pro', 'educator']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { userId } = await params
    const { planTier } = await request.json()

    if (!VALID_TIERS.includes(planTier)) {
      throw new ValidationError(`Invalid plan tier: ${planTier}`)
    }

    const supabase = createAdminClient()

    // Check user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) throw new NotFoundError('User')

    const limits = getPlanLimits(planTier as PlanTier)

    // Update profiles table
    await supabase
      .from('profiles')
      .update({
        plan_tier: planTier,
        books_limit: limits.booksPerMonth,
      })
      .eq('id', userId)

    // Update auth user_metadata so the account page reflects the change immediately
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { plan_tier: planTier },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
