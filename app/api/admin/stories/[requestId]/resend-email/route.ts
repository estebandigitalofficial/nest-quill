import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { sendBookReadyEmail } from '@/lib/services/email'
import { AuthError, NotFoundError, toApiError } from '@/lib/utils/errors'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { requestId } = await params
    const supabase = createAdminClient()

    const { data: req } = await supabase
      .from('story_requests')
      .select('id, user_email, child_name, status')
      .eq('id', requestId)
      .single()

    if (!req) throw new NotFoundError('Story request')

    if (req.status !== 'complete') {
      return NextResponse.json({ message: 'Story is not complete yet' }, { status: 400 })
    }

    const { data: story } = await supabase
      .from('generated_stories')
      .select('title')
      .eq('request_id', requestId)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    await sendBookReadyEmail({
      toEmail: req.user_email,
      childName: req.child_name,
      storyTitle: story?.title ?? `${req.child_name}'s Story`,
      downloadUrl: `${appUrl}/story/${requestId}`,
      requestId,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
