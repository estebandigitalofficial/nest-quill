import { NextRequest, NextResponse } from 'next/server'
import { pdfEntitledFor } from '@/lib/entitlements/policy'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStoryDripEmail, sendSignupDripEmail, sendDripEmailFromTemplate } from '@/lib/services/email'
import { getUnsubscribeSecret, UNSUBSCRIBE_SECRET_ENV } from '@/lib/email/unsubscribe'
import { getAppUrl } from '@/lib/utils/appUrl'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Called daily by Vercel Cron. Vercel attaches Authorization: Bearer <CRON_SECRET>.
//
// Every email this route sends is marketing / product-engagement mail, so every
// send goes through lib/services/email's marketing senders, which consult
// marketing_email_suppressions BEFORE calling Resend and stamp an unsubscribe
// link. A suppressed recipient comes back as { sent: false }: nothing is sent
// and nothing is written to drip_email_log, so the log stays an honest record
// of deliveries. Each (recipient, sequence, step, reference) is only eligible
// inside its one-day window, so a suppressed recipient costs one lookup per
// step and is never retried indefinitely.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  // Fail closed: without the unsubscribe signing secret no marketing email can
  // carry a working unsubscribe link, so none may be sent.
  try {
    getUnsubscribeSecret()
  } catch (err) {
    console.error('Drip cron aborted:', err)
    return NextResponse.json({ error: `Marketing email disabled: ${UNSUBSCRIBE_SECRET_ENV} is not configured` }, { status: 500 })
  }

  const supabase = createAdminClient()
  const results = { storyDrip: 0, signupDrip: 0, skipped: 0, suppressed: 0, errors: 0 }

  // ── Load enabled templates from DB ──────────────────────────────────────────
  const { data: dbTemplates } = await supabase
    .from('email_drip_templates')
    .select('*')
    .eq('enabled', true)
    .order('sequence')
    .order('step')

  const templateMap = new Map<string, { subject: string; body_html: string; delay_days: number }>()
  for (const t of dbTemplates ?? []) {
    templateMap.set(`${t.sequence}:${t.step}`, {
      subject: t.subject,
      body_html: t.body_html,
      delay_days: t.delay_days,
    })
  }

  // Build step lists from DB templates, falling back to hardcoded
  const storySteps = [...new Set([
    ...(dbTemplates ?? []).filter(t => t.sequence === 'story').map(t => t.step),
    2, 4, 6, // fallback
  ])].sort()

  const signupSteps = [...new Set([
    ...(dbTemplates ?? []).filter(t => t.sequence === 'signup').map(t => t.step),
    1, 3, 5, 7, // fallback
  ])].sort()

  const APP_URL = getAppUrl()

  // ── Story drip ──────────────────────────────────────────────────────────────
  for (const step of storySteps) {
    const tmpl = templateMap.get(`story:${step}`)
    const delayDays = tmpl?.delay_days ?? step
    const upper = new Date(Date.now() - delayDays * 86_400_000).toISOString()
    const lower = new Date(Date.now() - (delayDays + 1) * 86_400_000).toISOString()

    const { data: stories } = await supabase
      .from('story_requests')
      .select('id, user_email, child_name, plan_tier, entitlement_source, pdf_entitled')
      .eq('status', 'complete')
      .gte('completed_at', lower)
      .lte('completed_at', upper)

    for (const story of stories ?? []) {
      const { data: alreadySent } = await supabase
        .from('drip_email_log')
        .select('id')
        .eq('recipient_email', story.user_email)
        .eq('sequence', 'story')
        .eq('step', step)
        .eq('reference_id', story.id)
        .maybeSingle()

      if (alreadySent) { results.skipped++; continue }

      try {
        const outcome = tmpl
          ? await sendDripEmailFromTemplate(tmpl, {
              toEmail: story.user_email,
              variables: {
                child_name: story.child_name,
                story_url: `${APP_URL}/story/${story.id}`,
                create_url: `${APP_URL}/create`,
                pricing_url: `${APP_URL}/pricing`,
                plan_tier: story.plan_tier,
              },
            })
          : await sendStoryDripEmail(step, {
              toEmail: story.user_email,
              childName: story.child_name,
              requestId: story.id,
              planTier: story.plan_tier,
              pdfEntitled: pdfEntitledFor(story as unknown as { entitlement_source?: string | null; pdf_entitled?: boolean | null; plan_tier?: string | null }),
            })
        if (!outcome.sent) {
          if (outcome.reason === 'suppressed') results.suppressed++
          else results.skipped++
          continue
        }
        await supabase.from('drip_email_log').insert({
          recipient_email: story.user_email,
          sequence: 'story',
          step,
          reference_id: story.id,
        })
        results.storyDrip++
      } catch (err) {
        console.error(`Story drip step ${step} failed for ${story.id}:`, err)
        results.errors++
      }
    }
  }

  // ── Signup drip ─────────────────────────────────────────────────────────────
  for (const step of signupSteps) {
    const tmpl = templateMap.get(`signup:${step}`)
    const delayDays = tmpl?.delay_days ?? step
    const upper = new Date(Date.now() - delayDays * 86_400_000).toISOString()
    const lower = new Date(Date.now() - (delayDays + 1) * 86_400_000).toISOString()

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .gte('created_at', lower)
      .lte('created_at', upper)

    for (const profile of profiles ?? []) {
      if (step === 1) {
        const { count } = await supabase
          .from('story_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
        if ((count ?? 0) > 0) { results.skipped++; continue }
      }

      const { data: alreadySent } = await supabase
        .from('drip_email_log')
        .select('id')
        .eq('recipient_email', profile.email)
        .eq('sequence', 'signup')
        .eq('step', step)
        .eq('reference_id', profile.id)
        .maybeSingle()

      if (alreadySent) { results.skipped++; continue }

      try {
        const outcome = tmpl
          ? await sendDripEmailFromTemplate(tmpl, {
              toEmail: profile.email,
              variables: {
                create_url: `${APP_URL}/create`,
                pricing_url: `${APP_URL}/pricing`,
              },
            })
          : await sendSignupDripEmail(step, { toEmail: profile.email })
        if (!outcome.sent) {
          if (outcome.reason === 'suppressed') results.suppressed++
          else results.skipped++
          continue
        }
        await supabase.from('drip_email_log').insert({
          recipient_email: profile.email,
          sequence: 'signup',
          step,
          reference_id: profile.id,
        })
        results.signupDrip++
      } catch (err) {
        console.error(`Signup drip step ${step} failed for ${profile.id}:`, err)
        results.errors++
      }
    }
  }

  return NextResponse.json(results)
}
