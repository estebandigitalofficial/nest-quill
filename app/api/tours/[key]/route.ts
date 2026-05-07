// GET /api/tours/[key] — returns the tour + its steps (when enabled),
// plus the signed-in user's progress (null for guests).
//
// Reads use the cookie-bound supabase client; RLS allows anon SELECT
// on enabled tours and per-user reads on user_tour_progress.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tour, TourProgress, TourStep } from '@/lib/tours/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const supabase = await createClient()

  // Tour metadata + steps via the admin client (avoids RLS-shape inference
  // problems on the typed cookie client; tours are public-readable anyway).
  const admin = createAdminClient()
  const { data: tourRow } = await admin
    .from('guided_tours')
    .select('id, key, title, description, page, enabled')
    .eq('key', key)
    .eq('enabled', true)
    .maybeSingle()
  if (!tourRow) return NextResponse.json({ tour: null, progress: null })

  const { data: stepsRows } = await admin
    .from('guided_tour_steps')
    .select('id, step_order, target_selector, title, body, placement, action_label, requires_interaction, advance_on, advance_selector, wait_message')
    .eq('tour_id', tourRow.id)
    .order('step_order', { ascending: true })

  const steps: TourStep[] = (stepsRows ?? []).map(r => ({
    id: r.id as string,
    step_order: r.step_order as number,
    target_selector: (r.target_selector as string | null) ?? null,
    title: r.title as string,
    body: r.body as string,
    placement: (r.placement as TourStep['placement']) ?? 'bottom',
    action_label: (r.action_label as string | null) ?? null,
    requires_interaction: !!r.requires_interaction,
    advance_on: ((r.advance_on as string) === 'click' ? 'click' : 'next_button'),
    advance_selector: (r.advance_selector as string | null) ?? null,
    wait_message: (r.wait_message as string | null) ?? null,
  }))

  const tour: Tour = {
    id: tourRow.id as string,
    key: tourRow.key as string,
    title: tourRow.title as string,
    description: (tourRow.description as string | null) ?? null,
    page: (tourRow.page as string | null) ?? null,
    steps,
  }

  // Optional per-user progress.
  const { data: { user } } = await supabase.auth.getUser()
  let progress: TourProgress | null = null
  if (user) {
    const { data: row } = await admin
      .from('user_tour_progress')
      .select('tour_key, completed, skipped, last_step')
      .eq('user_id', user.id)
      .eq('tour_key', key)
      .maybeSingle()
    if (row) {
      progress = {
        tour_key: row.tour_key as string,
        completed: !!row.completed,
        skipped: !!row.skipped,
        last_step: (row.last_step as number) ?? 0,
      }
    }
  }

  return NextResponse.json({ tour, progress })
}
