import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { AuthError, NotFoundError, toApiError } from '@/lib/utils/errors'

type RouteContext = { params: Promise<{ requestId: string }> }

// POST /api/admin/stories/[requestId]/generate-images
//
// Admin-only backfill that asks the process-story Edge Function to generate
// illustrations for an already-complete story. Reuses the existing image
// pipeline by passing { mode: 'images_only' } so we don't duplicate
// OpenAI/storage code in two places.
//
// Concurrency is gated inside the Edge Function via a worker_id atomic
// claim that does NOT change status — the story stays 'complete'
// throughout, ownership/share access remain intact, and the standard
// retry/force-requeue paths keep working independently.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { requestId } = await params
    const admin = createAdminClient()

    // Pre-flight: confirm the story is in a state that makes sense to backfill.
    // The Edge Function repeats these checks defensively.
    const { data: storyReq } = await admin
      .from('story_requests')
      .select('id, status')
      .eq('id', requestId)
      .single()
    if (!storyReq) throw new NotFoundError('Story request')
    if (storyReq.status !== 'complete') {
      return NextResponse.json(
        { message: `Story is "${storyReq.status}", not complete — use retry or force-requeue instead.` },
        { status: 400 },
      )
    }

    // How many scenes still need an image?
    const { count: missingCount } = await admin
      .from('story_scenes')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', requestId)
      .or('image_status.neq.complete,storage_path.is.null')

    if ((missingCount ?? 0) === 0) {
      return NextResponse.json({ message: 'All illustrations are already generated for this story.', missing: 0 })
    }

    const baseUrl = process.env.EDGE_FUNCTION_BASE_URL
    if (!baseUrl) {
      return NextResponse.json({ message: 'EDGE_FUNCTION_BASE_URL is not configured.' }, { status: 503 })
    }

    const res = await fetch(`${baseUrl}/process-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ requestId, mode: 'images_only' }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { message: body.message ?? `Edge Function responded with ${res.status}.` },
        { status: res.status === 409 ? 409 : 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      generated: body.generated ?? 0,
      failed: body.failed ?? 0,
      missingBefore: body.missingBefore ?? 0,
      totalScenes: body.totalScenes ?? 0,
    })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
