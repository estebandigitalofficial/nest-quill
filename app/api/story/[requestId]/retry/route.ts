import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { NotFoundError, toApiError } from '@/lib/utils/errors'
import { checkRetryEligibility, computeRetryAfter } from '@/lib/limits/retryRules'
import type { StoryRequest } from '@/types/database'

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

    // Centralized retry eligibility — enforces per-failure-code max
    // attempts, retryable=false, and the retry_after cooldown window.
    // Admins bypass.
    const eligibility = checkRetryEligibility({
      failureCode: (storyRequest as unknown as { failure_code: string | null }).failure_code,
      retryable: (storyRequest as unknown as { retryable: boolean | null }).retryable,
      retryCount: storyRequest.retry_count,
      retryAfter: (storyRequest as unknown as { retry_after: string | null }).retry_after,
      isAdmin: !!adminCtx,
    })
    if (!eligibility.eligible) {
      // Log the rejection so the timeline reflects retry-storm protection.
      await adminSupabase.from('processing_logs').insert({
        request_id: requestId,
        level: 'warning',
        stage: 'retry_rejected',
        message: eligibility.reason ?? 'Retry not eligible',
      })
      return NextResponse.json(
        { message: eligibility.reason, retryAfterSeconds: eligibility.retryAfterSeconds },
        { status: eligibility.retryAfterSeconds ? 429 : 400 },
      )
    }

    // Clear lock + lifecycle stamps in addition to status. The Edge Function
    // claims a new worker_id on entry, so leaving a stale one here is mostly
    // benign today, but explicitly resetting matches admin force-requeue and
    // keeps stuck-story dashboards (filter on processing_started_at) honest.
    // We deliberately do NOT touch the saved request inputs (child_*, story_*,
    // etc.) — the whole point of retry is to reuse them.
    // Pre-arm retry_after for the *next* potential failure so storm
    // protection kicks in automatically without additional code in
    // the Edge Function. If this retry succeeds, retry_after stays
    // future-dated but irrelevant (status flips to complete).
    const nextRetryAfter = computeRetryAfter(
      (storyRequest as unknown as { failure_code: string | null }).failure_code,
      storyRequest.retry_count + 1,
    )

    await adminSupabase
      .from('story_requests')
      .update({
        status: 'queued',
        progress_pct: 0,
        status_message: 'Retrying your story…',
        last_error: null,
        worker_id: null,
        worker_lease_expires_at: null,
        worker_heartbeat_at: null,
        processing_started_at: null,
        completed_at: null,
        retry_count: storyRequest.retry_count + 1,
        retry_after: nextRetryAfter,
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
