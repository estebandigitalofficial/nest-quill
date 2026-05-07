// POST /api/admin/stories/[id]/cancel
// Soft-cancel a story request. Sets status='failed' with a marker
// failure_code so it's distinguishable from a real failure, releases
// the worker_id, and writes a processing_logs entry. Audit-safe: no
// rows deleted, no history rewritten.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

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

  await db.from('processing_logs').insert({
    request_id: requestId,
    level: 'warning',
    stage: 'admin_cancel',
    message: `Cancelled by admin (${ctx.userId})`,
  })

  return NextResponse.json({ ok: true })
}
