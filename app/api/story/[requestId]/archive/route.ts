import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotFoundError, toApiError } from '@/lib/utils/errors'

type RouteContext = { params: Promise<{ requestId: string }> }

// POST /api/story/[requestId]/archive — soft-delete from the user's
// dashboard. Sets archived_at/archived_by; the row, scenes, and storage
// assets stay untouched so admins can still see it and the user can
// restore. Logged-in users only — there is no guest dashboard today.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { requestId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: storyReq } = await admin
      .from('story_requests')
      .select('id, user_id, archived_at')
      .eq('id', requestId)
      .single()
    if (!storyReq) throw new NotFoundError('Story')
    if (storyReq.user_id !== user.id) {
      // Don't leak existence: same shape as a missing row.
      throw new NotFoundError('Story')
    }
    if (storyReq.archived_at) {
      // Idempotent — return ok without re-stamping.
      return NextResponse.json({ ok: true, alreadyArchived: true })
    }

    const { error } = await admin
      .from('story_requests')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user.id,
      })
      .eq('id', requestId)
      .eq('user_id', user.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
