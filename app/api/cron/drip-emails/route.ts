import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStoryDripEmail, sendSignupDripEmail } from '@/lib/services/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Called daily by Vercel Cron. Vercel attaches Authorization: Bearer <CRON_SECRET>.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const results = { storyDrip: 0, signupDrip: 0, skipped: 0, errors: 0 }

  // ── Story drip ──────────────────────────────────────────────────────────────
  // Triggered N days after a story completes. Window is [N days ago, N+1 days ago].
  for (const step of [2, 4, 6]) {
    const upper = new Date(Date.now() - step * 86_400_000).toISOString()
    const lower = new Date(Date.now() - (step + 1) * 86_400_000).toISOString()

    const { data: stories } = await supabase
      .from('story_requests')
      .select('id, user_email, child_name, plan_tier')
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
        await sendStoryDripEmail(step, {
          toEmail: story.user_email,
          childName: story.child_name,
          requestId: story.id,
          planTier: story.plan_tier,
        })
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
  // Triggered N days after a user profile was created.
  for (const step of [1, 3, 5, 7]) {
    const upper = new Date(Date.now() - step * 86_400_000).toISOString()
    const lower = new Date(Date.now() - (step + 1) * 86_400_000).toISOString()

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .gte('created_at', lower)
      .lte('created_at', upper)

    for (const profile of profiles ?? []) {
      // Day 1: only send if the user hasn't created any story yet
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
        await sendSignupDripEmail(step, { toEmail: profile.email })
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
