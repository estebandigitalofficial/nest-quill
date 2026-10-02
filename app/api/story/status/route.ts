import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotFoundError, toApiError } from '@/lib/utils/errors'
import { sendBookReadyEmail } from '@/lib/services/email'
import { sendAdminNotification, buildStoryCompletedEmail, buildStoryFailedEmail } from '@/lib/services/adminNotifications'
import type { StoryRequest } from '@/types/database'
import type { StoryStatusResponse } from '@/types/story'
import { getSetting } from '@/lib/settings/appSettings'
import { appUrl } from '@/lib/utils/appUrl'
import { createNotification } from '@/lib/notifications/createNotification'
import { runClaimedOnce } from '@/lib/limits/idempotency'
import { exportIsCurrent } from '@/lib/services/pdfExports'
import { INTERNAL_FETCH_REDIRECT, internalUrl } from '@/lib/utils/internalOrigin'

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
    let isAdmin = !!user?.email && adminEmails.includes(user.email)
    if (!isAdmin && user) {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      if (profile?.is_admin === true) isAdmin = true
    }
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
      // Increment books_generated exactly once per completed story for logged-in users.
      // The UPDATE with eq('usage_counted', false) is atomic — only one concurrent
      // caller can flip it to true, preventing double-counting on repeated polls.
      if (storyRequest.user_id && !storyRequest.usage_counted) {
        const { data: claimed } = await adminSupabase
          .from('story_requests')
          .update({ usage_counted: true })
          .eq('id', requestId)
          .eq('usage_counted', false)
          .select('id')
          .maybeSingle()

        if (claimed) {
          await adminSupabase.rpc('increment_books_generated', { user_id_input: storyRequest.user_id })
        }
      }

      // PDF availability depends on the pdf_download_enabled flag, the plan
      // (free tier is skipped inside generate-pdf) and completion state.
      // beta_mode_enabled is deliberately not consulted: beta governs limits
      // and messaging, never whether an entitled plan gets its PDF.
      const pdfDownloadEnabled = await getSetting('pdf_download_enabled', false)

      if (pdfDownloadEnabled) {
        const { data: exportData } = await adminSupabase
          .from('book_exports')
          .select('id, storage_path, storage_bucket, created_at')
          .eq('request_id', requestId)
          .eq('is_latest', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // An export older than the story's current completion belongs to a
        // previous generation of the text: treat it as absent so a
        // replacement is assembled (generate-pdf demotes the old row).
        const currentExport = exportIsCurrent(exportData as { created_at: string } | null, storyRequest.completed_at)

        if (exportData && currentExport) {
          const exportRow = exportData as unknown as { storage_path: string; storage_bucket: string }
          const { data: urlData } = await adminSupabase.storage
            .from(exportRow.storage_bucket)
            .createSignedUrl(exportRow.storage_path, 60 * 60 * 24 * 7) // 7 days

          signedUrl = urlData?.signedUrl
        } else if (storyRequest.plan_tier !== 'free') {
          // No export yet — trigger PDF assembly in the background (Node.js, no CPU limit).
          // The generate-pdf route is idempotent; concurrent polls won't double-assemble.
          // Internal authenticated call: target THIS deployment's origin directly and
          // refuse redirects — following the apex→www redirect would drop the bearer.
          const generatePdfUrl = internalUrl(request, `/api/story/${requestId}/generate-pdf`)
          const pdfSecret = process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
          after(async () => {
            try {
              const res = await fetch(generatePdfUrl, {
                method: 'POST',
                headers: { Authorization: `Bearer ${pdfSecret}` },
                redirect: INTERNAL_FETCH_REDIRECT,
              })
              if (!res.ok) {
                const body = await res.text().catch(() => '')
                console.error('[status] generate-pdf trigger failed', requestId, res.status, body)
              }
            } catch (err) {
              console.error('[status] generate-pdf trigger error', requestId, err)
            }
          })
        }
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
          const storyUrl = appUrl(`/story/${requestId}`)

          after(async () => {
            // Fallback sender only. The worker's completion callback
            // (/api/internal/story-completed) is the primary path; the
            // claim guarantees at most one successful send, and a failed
            // send releases the claim so the next caller can retry.
            const run = await runClaimedOnce(`ready_email:${requestId}`, 'ready_email', requestId, async () => {
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
            })
            if (run.outcome === 'failed') {
              const reason = run.error instanceof Error ? run.error.message : String(run.error)
              console.error('[status] ready email failed', requestId, reason, run.released ? '(claim released)' : '(claim NOT released)')
              await createAdminClient()
                .from('delivery_logs')
                .insert({
                  request_id: requestId,
                  channel: 'email',
                  status: 'failed',
                  recipient_email: storyRequest.user_email,
                  failure_reason: reason,
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

      // User-facing bell notification — only for logged-in users with a
      // user_id. Deduped on (user_id, type, href) so repeated polls
      // against a failed story don't pile up rows.
      const failedUserId = (storyRequest as unknown as { user_id: string | null }).user_id
      if (failedUserId) {
        after(async () => {
          try {
            await createNotification({
              userId: failedUserId,
              type: 'story_failed',
              title: 'Story generation needs attention',
              body: 'Something went wrong while creating your story. You can retry it now.',
              href: `/story/${requestId}`,
              dedupe: true,
            })
          } catch (err) {
            console.error('[status] story_failed notification failed:', requestId, err)
          }
        })
      }
    }

    // ── Observational only ───────────────────────────────────────────────────
    // This route no longer advances processing. Stuck detection, auto-fail
    // and continuation re-dispatch live in the worker's sweep mode
    // (supabase/functions/process-story, mode: 'sweep'), which runs on a
    // schedule independent of any browser. Closing the tab cannot stall a
    // book; reopening it cannot speed one up.

    // ── Image-skipped indicator ──────────────────────────────────────────────
    // The worker skips DALL·E only when image_generation_enabled is false or
    // the SKIP_IMAGE_GENERATION secret is set (never because of beta mode).
    // Neither signal is readable here, so for completed stories we infer
    // "skipped" from every scene lacking a stored image. The reader uses
    // this to show honest placeholder copy.
    let imagesSkipped: boolean | undefined
    let imagesSkippedReason: 'admin' | undefined
    if (storyRequest.status === 'complete') {
      const { data: anyImage } = await adminSupabase
        .from('story_scenes')
        .select('id')
        .eq('request_id', requestId)
        .eq('image_status', 'complete')
        .limit(1)
        .maybeSingle()
      if (!anyImage) {
        imagesSkipped = true
        imagesSkippedReason = 'admin'
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
      imagesSkipped,
      imagesSkippedReason,
    })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
