// POST /api/admin/stories/[id]/mark-failed
// Permanently fail a request — flips retryable to false so the user
// retry flow rejects it and admin lists know not to surface it as a
// retry candidate. Logs the action.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { requestId } = await params
  const body = await req.json().catch(() => ({})) as { reason?: string }
  const reason = (body.reason ?? 'Marked permanently failed by admin').slice(0, 200)

  const db = createAdminClient()
  const { error } = await db
    .from('story_requests')
    .update({
      status: 'failed',
      worker_id: null,
      retryable: false,
      last_error: reason,
      status_message: 'Permanently failed.',
    })
    .eq('id', requestId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('processing_logs').insert({
    request_id: requestId,
    level: 'error',
    stage: 'admin_mark_failed',
    message: `Marked permanently failed by admin (${ctx.userId}): ${reason}`,
  })

  return NextResponse.json({ ok: true })
}
