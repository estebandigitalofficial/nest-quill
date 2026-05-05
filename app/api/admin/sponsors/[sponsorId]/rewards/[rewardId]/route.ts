import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

type RouteContext = { params: Promise<{ sponsorId: string; rewardId: string }> }

const FIELDS = [
  'title', 'description', 'reward_type', 'value_cents',
  'max_redemptions', 'unlock_condition', 'is_active',
  'starts_at', 'ends_at',
] as const

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId, rewardId } = await params
  const body = await req.json() as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (f in body) updates[f] = body[f]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('sponsor_rewards')
    .update(updates)
    .eq('id', rewardId)
    .eq('sponsor_id', sponsorId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId, rewardId } = await params
  const db = createAdminClient()
  const { error } = await db
    .from('sponsor_rewards')
    .delete()
    .eq('id', rewardId)
    .eq('sponsor_id', sponsorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
