// PATCH /api/tours/[key]/progress — records the signed-in user's
// progress through a tour. Body: { last_step?: number, completed?: boolean,
// skipped?: boolean }. No-op for guests; the UI relies on session
// storage to remember dismissals when there's no auth.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const body = (await req.json().catch(() => null)) as
    | { last_step?: number; completed?: boolean; skipped?: boolean }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true, guest: true })

  const update: Record<string, unknown> = {
    user_id: user.id,
    tour_key: key,
    updated_at: new Date().toISOString(),
  }
  if (typeof body.last_step === 'number') update.last_step = Math.max(0, body.last_step)
  if (typeof body.completed === 'boolean') {
    update.completed = body.completed
    if (body.completed) update.completed_at = new Date().toISOString()
  }
  if (typeof body.skipped === 'boolean') update.skipped = body.skipped

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_tour_progress')
    .upsert(update, { onConflict: 'user_id,tour_key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
