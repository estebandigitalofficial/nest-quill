import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotFoundError, toApiError } from '@/lib/utils/errors'
import { sendBookReadyEmail } from '@/lib/services/email'
import type { StoryRequest } from '@/types/database'
import type { StoryStatusResponse } from '@/types/story'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json({ message: 'requestId is required' }, { status: 400 })
    }

    // Identify the caller
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const guestToken = request.cookies.get('guest_token')?.value

    // Use admin client to read — ownership check applied manually below.
    // We cast the result because hand-written Database types have limited
    // Supabase inference. Replace types/database.ts with `pnpm run types`
    // once Supabase CLI is running to get full type safety.
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('story_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error || !data) {
      throw new NotFoundError('Story request')
    }

    const storyRequest = data as unknown as StoryRequest

    // ── Ownership check ──────────────────────────────────────────────────────
    const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim()).filter(Boolean)
    const isAdmin = !!user?.email && adminEmails.includes(user.email)
    const isOwner =
      isAdmin ||
      (user && storyRequest.user_id === user.id) ||
      (guestToken && storyRequest.guest_token === guestToken)

    if (!isOwner) {
      throw new NotFoundError('Story request')
    }

    // ── If complete, fetch a signed download URL ─────────────────────────────
    let signedUrl: string | undefined

    if (storyRequest.status === 'complete') {
      const { data: exportData } = await adminSupabase
        .from('book_exports')
        .select('storage_path, storage_bucket')
        .eq('request_id', requestId)
        .eq('is_latest', true)
        .single()

      if (exportData) {
        const exportRow = exportData as unknown as { storage_path: string; storage_bucket: string }
        const { data: urlData } = await adminSupabase.storage
          .from(exportRow.storage_bucket)
          .createSignedUrl(exportRow.storage_path, 60 * 60 * 24 * 7) // 7 days

        signedUrl = urlData?.signedUrl
      }

      // Send completion email once — check delivery_logs to prevent duplicates
      if (storyRequest.user_email) {
        const { count } = await adminSupabase
          .from('delivery_logs')
          .select('id', { count: 'exact', head: true })
          .eq('request_id', requestId)
          .eq('channel', 'email')
          .in('status', ['sent', 'delivered'])

        if (count === 0) {
          // Fetch story title for the email
          const { data: storyData } = await adminSupabase
            .from('generated_stories')
            .select('title')
            .eq('request_id', requestId)
            .single()

          const storyTitle = (storyData as unknown as { title: string } | null)?.title ?? `${storyRequest.child_name}'s Story`
          const storyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/story/${requestId}`

          after(async () => {
            try {
              const { messageId } = await sendBookReadyEmail({
                toEmail: storyRequest.user_email,
                childName: storyRequest.child_name,
                storyTitle,
                downloadUrl: storyUrl,
                requestId,
              })

              await createAdminClient()
                .from('delivery_logs')
                .insert({
                  request_id: requestId,
                  channel: 'email',
                  status: 'sent',
                  recipient_email: storyRequest.user_email,
                  resend_message_id: messageId,
                })
            } catch {
              await createAdminClient()
                .from('delivery_logs')
                .insert({
                  request_id: requestId,
                  channel: 'email',
                  status: 'failed',
                  recipient_email: storyRequest.user_email,
                })
            }
          })
        }
      }
    }

    return NextResponse.json<StoryStatusResponse>({
      requestId: storyRequest.id,
      status: storyRequest.status,
      progressPct: storyRequest.progress_pct,
      statusMessage: storyRequest.status_message ?? '',
      childName: storyRequest.child_name,
      planTier: storyRequest.plan_tier,
      signedUrl,
      completedAt: storyRequest.completed_at ?? undefined,
    })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
