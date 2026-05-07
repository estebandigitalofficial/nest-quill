import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tourId } = await params
  const body = await req.json().catch(() => null) as { enabled?: boolean } | null
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db
    .from('guided_tours')
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq('id', tourId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
