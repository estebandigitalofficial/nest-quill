import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotFoundError, toApiError } from '@/lib/utils/errors'

type RouteContext = { params: Promise<{ requestId: string }> }

// POST /api/story/[requestId]/restore — undo an archive. Clears
// archived_at/archived_by so the row reappears in the default
// "Your stories" view.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { requestId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: storyReq } = await admin
      .from('story_requests')
      .select('id, user_id')
      .eq('id', requestId)
      .single()
    if (!storyReq) throw new NotFoundError('Story')
    if (storyReq.user_id !== user.id) throw new NotFoundError('Story')

    // 3C-3 restore hardening: the UPDATE returns the rows it touched. If the
    // story was permanently deleted between the ownership read above and this
    // write (the 20240074 deletion function holds the row lock until its transaction
    // commits), zero rows match and the customer gets the same 404 as for a
    // story that never existed — never a false "restored". The reverse order
    // needs nothing here: once archived_at is cleared, the deletion function's
    // locked eligibility check returns not_eligible.
    const { data: restored, error } = await admin
      .from('story_requests')
      .update({ archived_at: null, archived_by: null })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .select('id')
    if (error) throw error
    if (!restored || restored.length === 0) throw new NotFoundError('Story')

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
