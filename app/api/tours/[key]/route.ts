// GET /api/tours/[key] — returns the tour catalog row + its steps
// when the master switch is on AND the tour is enabled. Per-user
// progress is included only for signed-in users.
//
// Catalog reads use the service-role admin client. Tours are not
// private — they're loaded for guests too — so RLS doesn't gate
// the read; the admin client also sidesteps any column-shape
// inference issues on the typed cookie client.
//
// Every reason for "no tour" is logged AND surfaced in the response
// `debug` block so silent failures stop happening.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSettingEnabled } from '@/lib/settings/gates'
import { getSetting } from '@/lib/settings/appSettings'
import type { Tour, TourProgress, TourStep } from '@/lib/tours/types'

interface DebugBlock {
  gate_raw: unknown
  gate_parsed: boolean
  tour_query_error: { code?: string; message?: string } | null
  tour_row_found: boolean
  steps_query_error: { code?: string; message?: string } | null
  step_count: number
  reason: 'gate_off' | 'tour_query_error' | 'tour_not_found' | 'steps_query_error' | 'no_steps' | 'ok'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const debug: DebugBlock = {
    gate_raw: null,
    gate_parsed: false,
    tour_query_error: null,
    tour_row_found: false,
    steps_query_error: null,
    step_count: 0,
    reason: 'ok',
  }

  // ── Stage 1: master gate ───────────────────────────────────────────
  debug.gate_raw = await getSetting<unknown>('guided_tours_enabled', undefined)
  debug.gate_parsed = await isSettingEnabled('guided_tours_enabled')
  if (!debug.gate_parsed) {
    debug.reason = 'gate_off'
    console.info('[tours] gate off', { key, gate_raw: debug.gate_raw })
    return NextResponse.json({ tour: null, progress: null, debug })
  }

  const admin = createAdminClient()

  // ── Stage 2: tour catalog row ──────────────────────────────────────
  // Production columns are: id, tour_key, name, description, enabled
  // (no `title`, no `page`). The API response still exposes Tour.key,
  // Tour.title, and Tour.page so the frontend types stay stable —
  // we map name → title and default page to '/create' (every tour
  // we ship today runs there).
  const { data: tourRow, error: tourErr } = await admin
    .from('guided_tours')
    .select('id, tour_key, name, description, enabled')
    .eq('tour_key', key)
    .eq('enabled', true)
    .maybeSingle()
  if (tourErr) {
    debug.tour_query_error = { code: tourErr.code, message: tourErr.message }
    debug.reason = 'tour_query_error'
    console.error('[tours] tour query error', { key, code: tourErr.code, message: tourErr.message, hint: tourErr.hint })
    return NextResponse.json({ tour: null, progress: null, debug }, { status: 200 })
  }
  if (!tourRow) {
    debug.reason = 'tour_not_found'
    console.warn('[tours] tour row not found', { key })
    return NextResponse.json({ tour: null, progress: null, debug })
  }
  debug.tour_row_found = true

  // ── Stage 3: steps ─────────────────────────────────────────────────
  // Production guided_tour_steps columns (verified):
  //   id, tour_id, step_order, title, body, target_selector,
  //   placement, requires_interaction, config,
  //   advance_on, advance_selector, wait_message
  // No `action_label`. The frontend TourStep type still includes
  // action_label; we map it to null below to keep the type stable.
  const { data: stepsRows, error: stepsErr } = await admin
    .from('guided_tour_steps')
    .select('id, step_order, target_selector, title, body, placement, requires_interaction, advance_on, advance_selector, wait_message')
    .eq('tour_id', tourRow.id)
    .order('step_order', { ascending: true })
  if (stepsErr) {
    debug.steps_query_error = { code: stepsErr.code, message: stepsErr.message }
    debug.reason = 'steps_query_error'
    console.error('[tours] steps query error', { tour_id: tourRow.id, code: stepsErr.code, message: stepsErr.message, hint: stepsErr.hint })
    return NextResponse.json({ tour: null, progress: null, debug }, { status: 200 })
  }

  const steps: TourStep[] = (stepsRows ?? []).map(r => ({
    id: r.id as string,
    step_order: r.step_order as number,
    target_selector: (r.target_selector as string | null) ?? null,
    title: r.title as string,
    body: r.body as string,
    placement: (r.placement as TourStep['placement']) ?? 'bottom',
    // Production schema has no action_label column. The frontend
    // TourStep type still allows it for forward-compat; map null
    // here so GuideQuill renders the default "Next" / "Got it" copy.
    action_label: null,
    requires_interaction: !!r.requires_interaction,
    advance_on: ((r.advance_on as string) === 'click' ? 'click' : 'next_button'),
    advance_selector: (r.advance_selector as string | null) ?? null,
    wait_message: (r.wait_message as string | null) ?? null,
  }))
  debug.step_count = steps.length

  if (steps.length === 0) {
    // A row with no steps is unusable — surface it instead of pretending
    // to deliver an empty tour.
    debug.reason = 'no_steps'
    console.warn('[tours] tour has zero steps', { key, tour_id: tourRow.id })
    return NextResponse.json({ tour: null, progress: null, debug })
  }

  const tour: Tour = {
    id: tourRow.id as string,
    // Map DB column tour_key → API field `key` for frontend compat.
    key: tourRow.tour_key as string,
    // Map DB column `name` → API field `title`.
    title: tourRow.name as string,
    description: (tourRow.description as string | null) ?? null,
    // Production schema doesn't have a page column. Default to /create
    // (the path the wizard tour runs on); a separate field can be
    // wired later if/when we host tours on multiple routes.
    page: '/create',
    steps,
  }

  // ── Stage 4: per-user progress (best-effort) ───────────────────────
  let progress: TourProgress | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
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
  } catch (err) {
    // Auth lookup must never block tour rendering.
    console.warn('[tours] progress lookup failed (non-fatal)', err instanceof Error ? err.message : err)
  }

  console.info('[tours] returning tour', { key, step_count: steps.length, has_progress: !!progress })
  return NextResponse.json({ tour, progress, debug })
}
