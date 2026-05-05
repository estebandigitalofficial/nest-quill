import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

type RouteContext = { params: Promise<{ sponsorId: string }> }
const VALID_CATEGORIES = ['rewards', 'prizes', 'promotion', 'other'] as const

// Upsert an allocation row by (sponsor_id, category). Returns the
// updated set so the UI can re-render without a second round trip.
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sponsorId } = await params
  const body = await req.json() as { category?: string; allocated_cents?: number; notes?: string }
  const category = body.category
  if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  }
  const allocated = Number(body.allocated_cents ?? 0)
  if (!Number.isFinite(allocated) || allocated < 0) {
    return NextResponse.json({ error: 'allocated_cents must be a non-negative number.' }, { status: 400 })
  }

  const db = createAdminClient()

  // Guard: do not let the sum of allocations exceed the sponsor budget.
  const [{ data: sponsor }, { data: existing }] = await Promise.all([
    db.from('sponsors').select('total_budget_cents').eq('id', sponsorId).single(),
    db.from('sponsor_allocations').select('category, allocated_cents').eq('sponsor_id', sponsorId),
  ])
  if (!sponsor) return NextResponse.json({ error: 'Sponsor not found.' }, { status: 404 })

  const otherTotal = (existing ?? [])
    .filter((a: { category: string }) => a.category !== category)
    .reduce((sum: number, a: { allocated_cents: number }) => sum + a.allocated_cents, 0)
  if (otherTotal + allocated > sponsor.total_budget_cents) {
    return NextResponse.json(
      { error: `Allocations would exceed total budget (${sponsor.total_budget_cents} cents).` },
      { status: 400 }
    )
  }

  const { error } = await db
    .from('sponsor_allocations')
    .upsert(
      { sponsor_id: sponsorId, category, allocated_cents: allocated, notes: body.notes ?? null },
      { onConflict: 'sponsor_id,category' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: rows } = await db
    .from('sponsor_allocations')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('category')
  return NextResponse.json({ allocations: rows ?? [] })
}
