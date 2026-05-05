import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('sponsors')
    .select('id, name, logo_url, description, contact_email, total_budget_cents, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sponsors: data ?? [] })
}

export async function POST(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    name?: string
    logo_url?: string
    description?: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    website_url?: string
    total_budget_cents?: number
    is_active?: boolean
    notes?: string
  }

  const name = body.name?.trim()
  if (!name || name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: 'Name must be 2-120 characters.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('sponsors')
    .insert({
      name,
      logo_url: body.logo_url ?? null,
      description: body.description ?? null,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      website_url: body.website_url ?? null,
      total_budget_cents: body.total_budget_cents ?? 0,
      is_active: body.is_active ?? true,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sponsor: data }, { status: 201 })
}
