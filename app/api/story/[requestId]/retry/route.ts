import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { NotFoundError, toApiError } from '@/lib/utils/errors'
import type { StoryRequest } from '@/types/database'

const MAX_RETRIES = 3

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params

    const adminCtx = await getAdminContext()
    const guestToken = request.cookies.get('guest_token')?.value

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('story_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error || !data) throw new NotFoundError('Story request')

    const storyRequest = data as unknown as StoryRequest

    // Import createClient lazily only when needed for non-admin ownership check
    let userId: string | null = null
    if (!adminCtx) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    }

    const isOwner =
      !!adminCtx ||
      (userId && storyRequest.user_id === userId) ||
      (guestToken && storyRequest.guest_token === guestToken)

    if (!isOwner) throw new NotFoundError('Story request')

    if (storyRequest.status !== 'failed') {
      return NextResponse.json({ message: 'Story is not in a failed state' }, { status: 400 })
    }

    if (!adminCtx && storyRequest.retry_count >= MAX_RETRIES) {
      return NextResponse.json(
        { message: 'Maximum retry attempts reached. Please start a new story.' },
        { status: 400 }
      )
    }

    // Clear lock + lifecycle stamps in addition to status. The Edge Function
    // claims a new worker_id on entry, so leaving a stale one here is mostly
    // benign today, but explicitly resetting matches admin force-requeue and
    // keeps stuck-story dashboards (filter on processing_started_at) honest.
    // We deliberately do NOT touch the saved request inputs (child_*, story_*,
    // etc.) — the whole point of retry is to reuse them.
    await adminSupabase
      .from('story_requests')
      .update({
        status: 'queued',
        progress_pct: 0,
        status_message: 'Retrying your story…',
        last_error: null,
        worker_id: null,
        processing_started_at: null,
        completed_at: null,
        retry_count: storyRequest.retry_count + 1,
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
        console.error('Failed to trigger retry pipeline for request', requestId, err)
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
