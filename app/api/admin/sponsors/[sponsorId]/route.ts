import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

type RouteContext = { params: Promise<{ sponsorId: string }> }

const FIELDS = [
  'name', 'logo_url', 'description',
  'contact_name', 'contact_email', 'contact_phone',
  'website_url', 'total_budget_cents', 'is_active', 'notes',
] as const

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId } = await params
  const db = createAdminClient()

  const [{ data: sponsor }, { data: allocations }, { data: rewards }] = await Promise.all([
    db.from('sponsors').select('*').eq('id', sponsorId).single(),
    db.from('sponsor_allocations').select('*').eq('sponsor_id', sponsorId).order('category'),
    db.from('sponsor_rewards').select('*').eq('sponsor_id', sponsorId).order('created_at', { ascending: false }),
  ])

  if (!sponsor) return NextResponse.json({ error: 'Sponsor not found.' }, { status: 404 })
  return NextResponse.json({ sponsor, allocations: allocations ?? [], rewards: rewards ?? [] })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId } = await params
  const body = await req.json() as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (f in body) updates[f] = body[f]
  }

  if (typeof updates.name === 'string') {
    const n = updates.name.trim()
    if (!n || n.length < 2 || n.length > 120) {
      return NextResponse.json({ error: 'Name must be 2-120 characters.' }, { status: 400 })
    }
    updates.name = n
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('sponsors')
    .update(updates)
    .eq('id', sponsorId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sponsor: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId } = await params
  const db = createAdminClient()
  // FK ON DELETE CASCADE handles allocations + rewards.
  const { error } = await db.from('sponsors').delete().eq('id', sponsorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
