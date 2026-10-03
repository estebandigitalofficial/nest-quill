// POST /api/admin/stories/[id]/cancel
// Soft-cancel a story request. Sets status='failed' with a marker
// failure_code so it's distinguishable from a real failure, releases
// the worker_id, and writes a processing_logs entry. Audit-safe: no
// rows deleted, no history rewritten.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { releaseFreeReservationIfTerminal } from '@/lib/entitlements/freeRelease'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { requestId } = await params
  const db = createAdminClient()

  const { error } = await db
    .from('story_requests')
    .update({
      status: 'failed',
      worker_id: null,
      failure_code: 'CANCELLED_BY_ADMIN',
      failure_stage: 'finalizing',
      retryable: false,
      last_error: 'Cancelled by admin.',
      status_message: 'Cancelled.',
    })
    .eq('id', requestId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // FREE-only: this is a terminal state, so give a Free slot back once.
  // Paid entitlements stay consumed; support resolves those cases.
  const { data: row } = await db
    .from('story_requests')
    .select('entitlement_source, user_id, status, usage_counted, entitlement_released_at, failure_code, retryable, retry_count, retry_after')
    .eq('id', requestId)
    .maybeSingle()
  if (row) await releaseFreeReservationIfTerminal(db, requestId, row as Record<string, unknown>)

  await db.from('processing_logs').insert({
    request_id: requestId,
    level: 'warning',
    stage: 'admin_cancel',
    message: `Cancelled by admin (${ctx.userId})`,
  })

  return NextResponse.json({ ok: true })
}
