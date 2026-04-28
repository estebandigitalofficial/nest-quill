import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { NotFoundError, AuthError, toApiError } from '@/lib/utils/errors'

const STUCK_STATUSES = ['generating_text', 'generating_images', 'assembling_pdf', 'queued', 'failed', 'complete']

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { requestId } = await params
    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('story_requests')
      .select('id, status')
      .eq('id', requestId)
      .single()

    if (error || !data) throw new NotFoundError('Story request')

    if (!STUCK_STATUSES.includes(data.status)) {
      return NextResponse.json(
        { message: `Cannot requeue a story with status "${data.status}"` },
        { status: 400 }
      )
    }

    await adminSupabase
      .from('story_requests')
      .update({
        status: 'queued',
        worker_id: null,
        progress_pct: 0,
        status_message: 'Re-queued by admin…',
        last_error: null,
        completed_at: null,
        processing_started_at: null,
      })
      .eq('id', requestId)

    after(async () => {
      try {
        const baseUrl = process.env.EDGE_FUNCTION_BASE_URL
        if (!baseUrl) return
        await fetch(`${baseUrl}/process-story`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ requestId }),
        })
      } catch (err) {
        console.error('Failed to trigger force-requeue pipeline for request', requestId, err)
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
