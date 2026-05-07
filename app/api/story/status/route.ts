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

      const [pdfDownloadEnabled, betaMode] = await Promise.all([
        getSetting('pdf_download_enabled', false),
        getSetting('beta_mode_enabled', false),
      ])

      if (pdfDownloadEnabled && !betaMode) {
        const { data: exportData } = await adminSupabase
          .from('book_exports')
          .select('storage_path, storage_bucket')
          .eq('request_id', requestId)
          .eq('is_latest', true)
          .maybeSingle()

        if (exportData) {
          const exportRow = exportData as unknown as { storage_path: string; storage_bucket: string }
          const { data: urlData } = await adminSupabase.storage
            .from(exportRow.storage_bucket)
            .createSignedUrl(exportRow.storage_path, 60 * 60 * 24 * 7) // 7 days

          signedUrl = urlData?.signedUrl
        } else if (storyRequest.plan_tier !== 'free') {
          // No export yet — trigger PDF assembly in the background (Node.js, no CPU limit).
          // The generate-pdf route is idempotent; concurrent polls won't double-assemble.
          const generatePdfUrl = appUrl(`/api/story/${requestId}/generate-pdf`)
          const pdfSecret = process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
          after(async () => {
            try {
              const res = await fetch(generatePdfUrl, {
                method: 'POST',
                headers: { Authorization: `Bearer ${pdfSecret}` },
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

    // ── Stuck-job auto-fail ──────────────────────────────────────────────────
    // "Stuck" = no progress within a stage-specific window, NOT total stage
    // duration. The reference is `updated_at`, which the worker bumps on every
    // image completion via setStatus() (an UPDATE on story_requests fires the
    // updated_at trigger). A 16-image run that's making real progress will
    // touch updated_at every few seconds and never trip these thresholds.
    //
    // Thresholds are deliberately generous during beta — rather miss a real
    // stuck job for a few extra minutes than false-positive a slow-but-progressing
    // generation. Admins can still force-requeue from the dashboard.
    const STUCK_MS: Record<string, number> = {
      // queued auto-fail: catches rows whose initial after() trigger from
      // /api/story/submit silently failed and that no user has polled
      // recently. Pairs with the 3-minute fallback re-trigger above —
      // re-trigger gets the first crack on every poll; auto-fail is the
      // safety net so stale queued rows can't sit forever.
      queued:            10 * 60 * 1000,
      generating_text:    5 * 60 * 1000, // single OpenAI call; updated_at moves only at claim, so this is effectively total stage time
      generating_images: 20 * 60 * 1000, // no-progress window — every successful image bumps updated_at via setStatus()
      assembling_pdf:     3 * 60 * 1000, // single render+upload op
    }
    const stuckMs = STUCK_MS[storyRequest.status]
    if (stuckMs) {
      // updated_at is the canonical "last activity" stamp:
      //   - generating_text: bumped at claim, then again only when stage flips
      //   - generating_images: bumped per-image via setStatus()
      //   - assembling_pdf: bumped when stage flipped
      // Continuation handoff (worker releases worker_id mid-run) also bumps
      // updated_at, so a continuation pending re-trigger is not mistaken for stuck.
      const lastActivityTs = storyRequest.updated_at
      const ageMs = Date.now() - new Date(lastActivityTs).getTime()
      if (ageMs > stuckMs) {
        console.warn('[status] auto-failing stuck request', requestId, storyRequest.status, `no progress for ${Math.round(ageMs / 1000)}s`)
        const minutesIdle = Math.round(ageMs / 60000)
        const reason = `No progress in ${storyRequest.status} for ${minutesIdle} minutes — auto-failed.`
        await adminSupabase
          .from('story_requests')
          .update({
            status: 'failed',
            worker_id: null,
            last_error: reason,
            status_message: 'Generation took too long. Please retry.',
          })
          .eq('id', requestId)
          // Only flip if still in the same stuck status with the same
          // last_activity stamp — avoids racing a worker that just completed
          // an image (which would have bumped updated_at).
          .eq('status', storyRequest.status)
          .eq('updated_at', lastActivityTs)
        // Reflect the change in the response so the UI shows the failed state immediately.
        storyRequest.status = 'failed'
        storyRequest.status_message = 'Generation took too long. Please retry.'
      }
    }

    // ── Fallback re-trigger ──────────────────────────────────────────────────
    // Case 1: queued with no worker for >3 min — original after() trigger likely failed.
    // Case 2: generating_images with no worker for >60 s — time-budget continuation
    //   released the worker_id and is waiting for the next run to pick up.
    // The Edge Function's atomic claim prevents double-processing in both cases.
    const triggerBaseUrl = process.env.EDGE_FUNCTION_BASE_URL
    const stalledQueued =
      storyRequest.status === 'queued' &&
      storyRequest.worker_id === null &&
      Date.now() - new Date(storyRequest.created_at).getTime() > 3 * 60 * 1000

    const timeBudgetContinuation =
      storyRequest.status === 'generating_images' &&
      storyRequest.worker_id === null &&
      Date.now() - new Date(storyRequest.updated_at).getTime() > 60 * 1000

    if (triggerBaseUrl && (stalledQueued || timeBudgetContinuation)) {
      const reason = stalledQueued ? 'stalled queued request' : 'time-budget continuation'
      console.log('[status] re-triggering', reason, requestId)
      after(async () => {
        try {
          const res = await fetch(`${triggerBaseUrl}/process-story`, {
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

    // ── Image-skipped indicator ──────────────────────────────────────────────
    // The worker skips DALL·E when beta_mode_enabled is on OR the
    // SKIP_IMAGE_GENERATION secret is set. We can read the app setting from
    // here directly; the worker secret is invisible to Next.js, so we
    // *infer* it for completed stories whose every scene lacks a
    // storage_path. The reader uses these to show honest placeholder copy.
    let imagesSkipped: boolean | undefined
    let imagesSkippedReason: 'beta' | 'admin' | undefined
    if (storyRequest.status === 'complete') {
      const betaModeOn = (await getSetting('beta_mode_enabled', false)) as boolean
      if (betaModeOn) {
        imagesSkipped = true
        imagesSkippedReason = 'beta'
      } else {
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
