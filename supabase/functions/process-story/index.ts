// @ts-nocheck — this file runs in Deno (Supabase Edge Function), not Node. TS server does not know Deno globals.
/**
 * PROCESS STORY — Supabase Edge Function
 *
 * Triggered by the Next.js submit route (fire-and-forget POST).
 * Owns the full pipeline state machine for a single story_request.
 *
 * Current state: pipeline shell — transitions through all statuses,
 * logs every stage, ends at 'complete'. AI steps are stubbed with
 * comments showing exactly where Phase 4 code slots in.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// EDGE_FUNCTION_SECRET is a shared local-dev secret passed via --env-file.
// Falls back to SUPABASE_SERVICE_ROLE_KEY in production where both sides use the same cloud key.
const EXPECTED_TOKEN = Deno.env.get('EDGE_FUNCTION_SECRET') ?? SUPABASE_SERVICE_ROLE_KEY

Deno.serve(async (req) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (token !== EXPECTED_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let requestId: string
  try {
    const body = await req.json()
    requestId = body.requestId
    if (!requestId) throw new Error('Missing requestId')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // ── Supabase admin client (bypasses RLS) ──────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Idempotency: skip if already claimed and not in a retriable state ─────
  const { data: storyRequest, error: fetchError } = await supabase
    .from('story_requests')
    .select('id, status, worker_id')
    .eq('id', requestId)
    .single()

  if (fetchError || !storyRequest) {
    return new Response('Story request not found', { status: 404 })
  }

  const retriable = ['queued', 'failed']
  if (storyRequest.worker_id !== null && !retriable.includes(storyRequest.status)) {
    return new Response(
      JSON.stringify({ requestId, skipped: true, reason: 'Already processing' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Claim this request ────────────────────────────────────────────────────
  const workerId = crypto.randomUUID()

  await supabase
    .from('story_requests')
    .update({
      worker_id: workerId,
      status: 'generating_text',
      processing_started_at: new Date().toISOString(),
      status_message: 'Writing your story…',
      progress_pct: 10,
      last_error: null,
    })
    .eq('id', requestId)

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function setStatus(
    status: string,
    message: string,
    progress: number,
    extra: Record<string, unknown> = {}
  ) {
    await supabase
      .from('story_requests')
      .update({ status, status_message: message, progress_pct: progress, ...extra })
      .eq('id', requestId)
  }

  async function log(
    stage: string,
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    metadata: Record<string, unknown> = {}
  ) {
    await supabase.from('processing_logs').insert({
      request_id: requestId,
      level,
      stage,
      message,
      metadata: { worker_id: workerId, ...metadata },
    })
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────

  try {
    await log('pipeline_start', 'Pipeline started')

    // ── Step 1: Generate story text ─────────────────────────────────────────
    // Phase 4: const story = await generateStoryText(supabase, requestId)
    //          await supabase.from('generated_stories').insert({ request_id: requestId, ...story })
    await log('generate_text', 'Story text generation started (stub)')
    await setStatus('generating_text', 'Writing your story…', 30)
    await log('generate_text', 'Story text generation complete (stub)', 'info', { stub: true })

    // ── Step 2: Generate illustrations ──────────────────────────────────────
    // Phase 4: for each scene → await generateImage(scene) → uploadToStorage()
    //          await supabase.from('story_scenes').upsert({ image_url, image_status: 'complete', ... })
    await setStatus('generating_images', 'Creating your illustrations…', 50)
    await log('generate_images', 'Illustration generation started (stub)')
    await log('generate_images', 'Illustration generation complete (stub)', 'info', { stub: true })

    // ── Step 3: Assemble PDF ─────────────────────────────────────────────────
    // Phase 4: const pdfPath = await assemblePDF(supabase, requestId)
    //          await supabase.from('book_exports').insert({ request_id: requestId, storage_path: pdfPath, ... })
    await setStatus('assembling_pdf', 'Putting your book together…', 80)
    await log('assemble_pdf', 'PDF assembly started (stub)')
    await log('assemble_pdf', 'PDF assembly complete (stub)', 'info', { stub: true })

    // ── Step 4: Deliver ──────────────────────────────────────────────────────
    // Phase 4: await sendBookReadyEmail(supabase, requestId)
    //          await supabase.from('delivery_logs').insert({ ... })
    await log('deliver', 'Delivery skipped (stub — no PDF yet)')

    // ── Complete ─────────────────────────────────────────────────────────────
    await supabase
      .from('story_requests')
      .update({
        status: 'complete',
        status_message: 'Your storybook is ready!',
        progress_pct: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    await log('pipeline_complete', 'Pipeline finished successfully')

    return new Response(
      JSON.stringify({ requestId, status: 'complete' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[process-story] requestId=${requestId} error:`, message)

    await supabase
      .from('story_requests')
      .update({
        status: 'failed',
        last_error: message,
        status_message: 'Something went wrong — we\'ll look into it.',
      })
      .eq('id', requestId)

    await log('pipeline_error', message, 'error')

    return new Response(
      JSON.stringify({ requestId, status: 'failed', error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})