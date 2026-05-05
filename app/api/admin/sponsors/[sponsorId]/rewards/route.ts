import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

type RouteContext = { params: Promise<{ sponsorId: string }> }
const VALID_TYPES = ['free_item', 'discount', 'digital_reward'] as const

export async function POST(req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId } = await params
  const body = await req.json() as {
    title?: string
    description?: string
    reward_type?: string
    value_cents?: number
    max_redemptions?: number | null
    unlock_condition?: Record<string, unknown>
    is_active?: boolean
    starts_at?: string | null
    ends_at?: string | null
  }

  const title = body.title?.trim()
  if (!title || title.length < 2 || title.length > 160) {
    return NextResponse.json({ error: 'Title must be 2-160 characters.' }, { status: 400 })
  }
  if (!body.reward_type || !(VALID_TYPES as readonly string[]).includes(body.reward_type)) {
    return NextResponse.json({ error: 'Invalid reward_type.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('sponsor_rewards')
    .insert({
      sponsor_id: sponsorId,
      title,
      description: body.description ?? null,
      reward_type: body.reward_type,
      value_cents: body.value_cents ?? 0,
      max_redemptions: body.max_redemptions ?? null,
      unlock_condition: body.unlock_condition ?? {},
      is_active: body.is_active ?? true,
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reward: data }, { status: 201 })
}
