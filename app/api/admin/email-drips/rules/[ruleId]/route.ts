import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ruleId } = await params
  const body = await req.json()
  const db = createAdminClient()

  const { error } = await db
    .from('email_drip_rules')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', ruleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ruleId } = await params
  const db = createAdminClient()

  const { error } = await db
    .from('email_drip_rules')
    .delete()
    .eq('id', ruleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
