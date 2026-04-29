import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotFoundError, toApiError } from '@/lib/utils/errors'
import { sendBookReadyEmail } from '@/lib/services/email'
import { sendAdminNotification, buildStoryCompletedEmail, buildStoryFailedEmail } from '@/lib/services/adminNotifications'
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
    // Complete stories are accessible to anyone with the direct URL — the UUID
    // is unguessable and acts as a capability token (same pattern as Figma share links).
    // In-progress and failed stories still require ownership to prevent enumeration.
    const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim()).filter(Boolean)
    const isAdmin = !!user?.email && adminEmails.includes(user.email)
    const isComplete = storyRequest.status === 'complete'
    const isOwner =
      isAdmin ||
      isComplete ||
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

      // Send completion email once — scope to null email_type (user emails only)
      if (storyRequest.user_email) {
        const { count } = await adminSupabase
          .from('delivery_logs')
          .select('id', { count: 'exact', head: true })
          .eq('request_id', requestId)
          .eq('channel', 'email')
          .is('email_type', null)
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

      // Admin story_completed notification (deduped via delivery_logs email_type)
      const { count: adminCompletedCount } = await adminSupabase
        .from('delivery_logs')
        .select('id', { count: 'exact', head: true })
        .eq('request_id', requestId)
        .eq('channel', 'email')
        .eq('email_type', 'admin_story_completed')
        .in('status', ['sent', 'delivered'])

      if ((adminCompletedCount ?? 0) === 0) {
        const { data: storyMeta } = await adminSupabase
          .from('generated_stories')
          .select('title')
          .eq('request_id', requestId)
          .single()
        const storyTitle = (storyMeta as unknown as { title: string } | null)?.title ?? `${storyRequest.child_name}'s Story`

        after(async () => {
          try {
            const { subject, html } = buildStoryCompletedEmail({
              requestId,
              childName: storyRequest.child_name,
              storyTitle,
              planTier: storyRequest.plan_tier,
              userEmail: storyRequest.user_email ?? undefined,
            })
            await sendAdminNotification('story_completed', subject, html, { requestId })
          } catch { /* non-blocking */ }
        })
      }
    }

    // Admin story_failed notification
    if (storyRequest.status === 'failed') {
      const { count: adminFailedCount } = await adminSupabase
        .from('delivery_logs')
        .select('id', { count: 'exact', head: true })
        .eq('request_id', requestId)
        .eq('channel', 'email')
        .eq('email_type', 'admin_story_failed')
        .in('status', ['sent', 'delivered'])

      if ((adminFailedCount ?? 0) === 0) {
        after(async () => {
          try {
            const { subject, html } = buildStoryFailedEmail({
              requestId,
              childName: storyRequest.child_name,
              storyTheme: storyRequest.story_theme ?? '',
              planTier: storyRequest.plan_tier,
              userEmail: storyRequest.user_email ?? undefined,
              lastError: (storyRequest as unknown as { last_error?: string }).last_error ?? undefined,
            })
            await sendAdminNotification('story_failed', subject, html, { requestId })
          } catch { /* non-blocking */ }
        })
      }
    }

    // ── Fallback re-trigger ──────────────────────────────────────────────────
    // If the request has been stuck in "queued" with no worker for >3 min,
    // the original trigger (fired in after() on submit) likely failed silently.
    // Re-fire it here — the Edge Function's idempotency check prevents double-processing.
    if (
      storyRequest.status === 'queued' &&
      storyRequest.worker_id === null &&
      Date.now() - new Date(storyRequest.created_at).getTime() > 3 * 60 * 1000
    ) {
      const baseUrl = process.env.EDGE_FUNCTION_BASE_URL
      if (baseUrl) {
        console.log('[status] re-triggering stalled queued request', requestId)
        after(async () => {
          try {
            const res = await fetch(`${baseUrl}/process-story`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ requestId }),
            })
            if (!res.ok) {
              const body = await res.text().catch(() => '')
              console.error('[status] re-trigger failed', requestId, res.status, body)
            }
          } catch (err) {
            console.error('[status] re-trigger error', requestId, err)
          }
        })
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
      learningMode: storyRequest.learning_mode ?? false,
    })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
