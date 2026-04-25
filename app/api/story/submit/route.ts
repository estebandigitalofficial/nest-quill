import { NextRequest, NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateStoryForm } from '@/lib/validators/story-form'
import { getPlanLimits, resolvePageCount } from '@/lib/plans/config'
import { canCreateBook } from '@/lib/plans/limits'
import { PlanLimitError, toApiError } from '@/lib/utils/errors'
import { sendSubmissionConfirmationEmail } from '@/lib/services/email'
import type { SubmitStoryResponse } from '@/types/story'

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse and validate the incoming form data ────────────────────────
    const body = await request.json()
    const formData = validateStoryForm(body)

    // ── 2. Identify the user (authenticated or guest) ───────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // For guests: read an existing guest_token cookie, or create a new one
    const cookieStore = await cookies()
    let guestToken: string | null = null

    if (!user) {
      guestToken = cookieStore.get('guest_token')?.value ?? crypto.randomUUID()
    }

    // ── 3. Check plan limits ─────────────────────────────────────────────────
    const limits = getPlanLimits(formData.planTier)
    const limitCheck = await canCreateBook(user?.id ?? null, formData.planTier, guestToken)

    if (!limitCheck.allowed) {
      throw new PlanLimitError(limitCheck.reason ?? 'Plan limit reached')
    }

    // Silently clamp story length to what the plan allows
    const resolvedPageCount = resolvePageCount(formData.storyLength, formData.planTier)

    // ── 4. Check if payment is required ─────────────────────────────────────
    const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
    const requiresPayment = paymentsEnabled && formData.planTier !== 'free'

    if (requiresPayment) {
      // STUB — Phase 2 will create a Stripe Checkout Session here
      // and return the checkoutUrl instead of proceeding
      return NextResponse.json(
        { requiresPayment: true, message: 'Payments not yet enabled' },
        { status: 402 }
      )
    }

    // ── 5. Insert the story request into the database ────────────────────────
    // Use the admin client so we can write regardless of RLS policies
    const adminSupabase = createAdminClient()

    // Read Vercel geo headers (populated automatically on Vercel deployments)
    const ipRaw = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    const ipAddress = ipRaw?.split(',')[0]?.trim() ?? null
    const geoCity = request.headers.get('x-vercel-ip-city')
      ? decodeURIComponent(request.headers.get('x-vercel-ip-city')!)
      : null
    const geoCountry = request.headers.get('x-vercel-ip-country') ?? null
    const geoRegion = request.headers.get('x-vercel-ip-country-region') ?? null

    const { data: storyRequest, error: insertError } = await adminSupabase
      .from('story_requests')
      .insert({
        user_id: user?.id ?? null,
        guest_token: guestToken,
        plan_tier: formData.planTier,
        child_name: formData.childName,
        child_age: formData.childAge,
        child_description: formData.childDescription ?? null,
        story_theme: formData.storyTheme,
        story_tone: formData.storyTone,
        story_moral: formData.storyMoral ?? null,
        story_length: resolvedPageCount,
        illustration_style: formData.illustrationStyle,
        dedication_text: formData.dedicationText ?? null,
        supporting_characters: formData.supportingCharacters ?? null,
        author_name: formData.authorName ?? null,
        closing_message: formData.closingMessage ?? null,
        custom_notes: formData.customNotes ?? null,
        user_email: formData.userEmail,
        learning_mode: formData.learningMode ?? false,
        learning_subject: formData.learningSubject ?? null,
        learning_grade: formData.learningGrade ?? null,
        learning_topic: formData.learningTopic ?? null,
        ip_address: ipAddress,
        geo_city: geoCity,
        geo_country: geoCountry,
        geo_region: geoRegion,
        status: 'queued',
        progress_pct: 0,
        status_message: 'Your story is in the queue...',
      })
      .select('id')
      .single()

    if (insertError || !storyRequest) {
      // Log the full Supabase error so you can see it in your terminal
      console.error('[story/submit] Supabase insert error:', {
        message: insertError?.message,
        code: insertError?.code,
        details: insertError?.details,
        hint: insertError?.hint,
      })
      throw new Error(
        insertError?.message
          ? `Database error: ${insertError.message}`
          : 'Failed to save your story request. Please try again.'
      )
    }

    const requestId = storyRequest.id

    // ── 6. Trigger the background processing pipeline + confirmation email ────
    after(async () => {
      try {
        await triggerProcessingPipeline(requestId)
      } catch (err) {
        console.error('Failed to trigger pipeline for request', requestId, err)
      }
    })

    after(async () => {
      try {
        await sendSubmissionConfirmationEmail(formData.userEmail, formData.childName, requestId)
      } catch (err) {
        console.error('Failed to send submission confirmation email', requestId, err)
      }
    })

    // ── 7. Build the response ────────────────────────────────────────────────
    const response = NextResponse.json<SubmitStoryResponse>({
      requestId,
      status: 'queued',
      requiresPayment: false,
    })

    // Set the guest_token cookie if this was a guest submission
    if (guestToken && !user) {
      response.cookies.set('guest_token', guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: '/',
      })
    }

    return response
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}

/**
 * Fires a request to the Supabase Edge Function that runs the AI pipeline.
 * This is intentionally NOT awaited — the HTTP handler returns first,
 * then the pipeline runs in the background.
 */
async function triggerProcessingPipeline(requestId: string): Promise<void> {
  const baseUrl = process.env.EDGE_FUNCTION_BASE_URL
  if (!baseUrl) {
    console.warn('EDGE_FUNCTION_BASE_URL not set — pipeline not triggered')
    return
  }

  const response = await fetch(`${baseUrl}/process-story`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Shared secret checked by the Edge Function.
      // Locally: set EDGE_FUNCTION_SECRET in .env.local and pass --env-file to supabase functions serve.
      // Production: falls back to SUPABASE_SERVICE_ROLE_KEY (same key on both sides in cloud).
      Authorization: `Bearer ${process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ requestId }),
  })

  if (!response.ok) {
    throw new Error(`Edge Function responded with ${response.status}`)
  }
}
