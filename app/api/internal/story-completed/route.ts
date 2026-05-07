import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookReadyEmail } from '@/lib/services/email'
import { appUrl } from '@/lib/utils/appUrl'
import { createNotification } from '@/lib/notifications/createNotification'

export async function POST(request: NextRequest) {
  // Internal route — verify shared secret (same token used by Edge Function calls)
  const authHeader = request.headers.get('authorization') ?? ''
  const secret = process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let requestId: string
  try {
    const body = await request.json()
    requestId = body.requestId
    if (!requestId) throw new Error('missing requestId')
  } catch {
    return NextResponse.json({ message: 'requestId is required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  try {
    // Idempotency — no-op if email was already sent (by this route or by a status poll)
    const { count } = await adminSupabase
      .from('delivery_logs')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', requestId)
      .eq('channel', 'email')
      .is('email_type', null)
      .in('status', ['sent', 'delivered'])

    if ((count ?? 0) > 0) {
      return NextResponse.json({ requestId, status: 'already_sent' })
    }

    const { data: storyReq, error: reqErr } = await adminSupabase
      .from('story_requests')
      .select('user_email, child_name, status, user_id')
      .eq('id', requestId)
      .single()

    if (reqErr || !storyReq) {
      return NextResponse.json({ message: 'Story request not found' }, { status: 404 })
    }

    if (!storyReq.user_email) {
      return NextResponse.json({ requestId, status: 'no_email' })
    }

    const { data: storyData } = await adminSupabase
      .from('generated_stories')
      .select('title')
      .eq('request_id', requestId)
      .single()

    const storyTitle = (storyData as unknown as { title: string } | null)?.title
      ?? `${(storyReq as unknown as { child_name: string }).child_name}'s Story`
    const storyUrl = appUrl(`/story/${requestId}`)
    const childName = (storyReq as unknown as { child_name: string }).child_name
    const toEmail = (storyReq as unknown as { user_email: string }).user_email

    try {
      const { messageId } = await sendBookReadyEmail({
        toEmail,
        childName,
        storyTitle,
        downloadUrl: storyUrl,
        requestId,
      })

      await adminSupabase.from('delivery_logs').insert({
        request_id: requestId,
        channel: 'email',
        status: 'sent',
        recipient_email: toEmail,
        resend_message_id: messageId,
      })

      // Bell notification — only for logged-in users; guests have no
      // user_id and therefore no notification feed. Deduped on
      // (user_id, type, href) so re-invocations don't pile up rows.
      const userId = (storyReq as unknown as { user_id: string | null }).user_id
      if (userId) {
        try {
          await createNotification({
            userId,
            type: 'story_complete',
            title: 'Your story is ready',
            body: `${childName}'s story is ready to read.`,
            href: `/story/${requestId}`,
            dedupe: true,
          })
        } catch (notifErr) {
          // Notifications are supplementary; never block the email path.
          console.error('[story-completed] notification failed:', requestId, notifErr)
        }
      }

      return NextResponse.json({ requestId, status: 'sent', messageId })
    } catch (emailErr) {
      const message = emailErr instanceof Error ? emailErr.message : String(emailErr)
      console.error('[story-completed] email failed:', requestId, message)

      await adminSupabase.from('delivery_logs').insert({
        request_id: requestId,
        channel: 'email',
        status: 'failed',
        recipient_email: toEmail,
        failure_reason: message,
      })

      return NextResponse.json({ message }, { status: 500 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[story-completed] error:', requestId, message)
    return NextResponse.json({ message }, { status: 500 })
  }
}
