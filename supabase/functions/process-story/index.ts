// @ts-nocheck — this file runs in Deno (Supabase Edge Function), not Node. TS server does not know Deno globals.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  BACKFILL_LEASE_MS,
  CLAIMABLE_STATUSES,
  DISPATCH_WAIT_MS,
  READY_EMAIL_RECOVERY_WINDOW_MS,
  SWEEP_GRACE_MS,
  SWEEP_STALE_MS,
  TIME_BUDGET_MS,
  coverStartAllowed,
  type DispatchOutcome,
  isAuthorizedBearer,
  isSweepEligible,
  isSweepStale,
  monotonicProgress,
  raceDispatch,
  readyEmailRecoveryCandidates,
  shouldSkipImages,
} from './policy.ts'
import { buildBookPrompt, buildPlanPrompt, deriveAgeBand, personalizationFieldsUsed } from './prompt.ts'
import {
  MAX_STAGE_ATTEMPTS,
  buildRepairMessages,
  safeParseJson,
  sumUsage,
  toSceneRows,
  validateBook,
  validateStoryPlan,
} from './plan.ts'
import { assessBookQuality } from './quality.ts'
import {
  buildCoverPrompt,
  buildImagePrompt,
  buildVisualBible,
  coverFailureUpdate,
  coverStoragePath,
  findPlanPage,
  shouldGenerateCover,
  validateVisualBible,
} from './visual.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'stories@nestandquill.com'

// Mirrors lib/utils/appUrl.ts — keep in sync. Vercel preview URLs leak
// into NEXT_PUBLIC_APP_URL on previews; reject them so user-facing emails
// always point at the canonical production host.
const _APP_URL_RAW = Deno.env.get('NEXT_PUBLIC_APP_URL')?.trim()
const APP_URL = (
  _APP_URL_RAW
  && /^https?:\/\//i.test(_APP_URL_RAW)
  && !/\.vercel\.app(?:[\/:]|$)/i.test(_APP_URL_RAW)
)
  ? _APP_URL_RAW.replace(/\/+$/, '')
  : 'https://nestandquill.com'
const EXPECTED_TOKEN = Deno.env.get('EDGE_FUNCTION_SECRET') ?? SUPABASE_SERVICE_ROLE_KEY
const SKIP_IMAGES = Deno.env.get('SKIP_IMAGE_GENERATION') === 'true'
const MOCK_PIPELINE = Deno.env.get('MOCK_PIPELINE') === 'true'

// TIME_BUDGET_MS (policy.ts) stops new expensive calls 40 s before the
// 150 s Edge Function hard limit. When the budget is reached the worker
// releases its claim (worker_id → null), dispatches a continuation
// invocation of itself, and returns 200. Nothing in the browser is
// involved; the scheduled sweep (mode: 'sweep') is the safety net if the
// chained invocation is ever lost.

// Where this function reaches itself for continuation + sweep dispatch.
// SUPABASE_URL is injected by the platform (hosted: https://<ref>.supabase.co,
// local: http://kong:8000). Override with PROCESS_STORY_SELF_URL if needed.
const SELF_URL = Deno.env.get('PROCESS_STORY_SELF_URL')
  ?? `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/process-story`

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fire a new invocation of this function and wait (briefly) until the
 * request has been accepted. The child invocation is independent: it
 * claims the row with its own worker id and lease.
 *
 * Parent lifetime: the promise handed to EdgeRuntime.waitUntil is the SAME
 * bounded race the caller awaits — the response or DISPATCH_WAIT_MS,
 * whichever comes first — so the parent isolate is kept alive for at most
 * DISPATCH_WAIT_MS after dispatch and never for the child's processing
 * run. On timeout the request has left this isolate and the outcome is
 * reported as 'timeout' (ok: true, status 0); if it was in fact lost, the
 * sweep re-dispatches the released row after SWEEP_GRACE_MS.
 */
async function dispatchSelf(body: Record<string, unknown>): Promise<DispatchOutcome> {
  const responsePromise = fetch(SELF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EXPECTED_TOKEN}`,
    },
    body: JSON.stringify(body),
  }).then(r => {
    // Drop the body immediately; we only care that the request was accepted.
    r.body?.cancel().catch(() => {})
    return { ok: r.ok, status: r.status }
  })

  const bounded = raceDispatch(responsePromise, DISPATCH_WAIT_MS, sleep)

  try {
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime
    if (rt && typeof rt.waitUntil === 'function') {
      rt.waitUntil(bounded.catch(() => {}))
    }
  } catch { /* not running on Supabase Edge Runtime */ }

  const outcome = await bounded
  console.log('[process-story] dispatchSelf', outcome.outcome, outcome.status ?? '', outcome.error ?? '')
  return outcome
}

// ── Fallback illustration style → DALL-E style hint map ─────────────────────

const FALLBACK_STYLE_HINTS: Record<string, string> = {
  watercolor: 'soft watercolor illustration, gentle washes of color, children\'s picture book style',
  cartoon: 'bright cartoon illustration, bold outlines, vibrant colors, fun and playful children\'s book style',
  storybook: 'classic storybook illustration, warm and detailed, fairy-tale aesthetic, painted children\'s book style',
  pencil_sketch: 'detailed pencil sketch illustration, hand-drawn, soft shading, charming children\'s book style',
  digital_art: 'clean digital illustration, polished artwork, colorful, modern children\'s book style',
}

type ConfigMap = Record<string, string>

// ── OpenAI helper ─────────────────────────────────────────────────────────────

interface OpenAIUsage { prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null }
interface OpenAIResult { content: string; usage: OpenAIUsage; model: string }

const TEXT_MODEL = 'gpt-4o'

/**
 * JSON-mode chat completion. Returns the content plus the usage block the
 * API reports (prompt_tokens / completion_tokens / total_tokens) so each
 * generation stage can be measured; nulls when the API omits usage.
 */
async function callOpenAI(messages: object[], model = TEXT_MODEL, temperature = 0.8): Promise<OpenAIResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const json = await res.json()
  const u = json.usage ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    content: json.choices?.[0]?.message?.content ?? '',
    usage: { prompt_tokens: num(u.prompt_tokens), completion_tokens: num(u.completion_tokens), total_tokens: num(u.total_tokens) },
    model: typeof json.model === 'string' ? json.model : model,
  }
}


const IMAGE_MODEL = 'dall-e-3'

/**
 * Style hint, age-band hint and safety suffix for this request. The safety
 * suffix uses `||` at every level so an admin who clears a field falls
 * through to the next layer instead of shipping a child illustration with
 * NO safety suffix. The hardcoded final default is the floor.
 */
function imageConfigFor(config: ConfigMap, illustrationStyle: string, childAge?: number): { styleHint: string; bandImageHint: string; safetySuffix: string } {
  const styleHint = config['image_style_' + illustrationStyle]
    ?? FALLBACK_STYLE_HINTS[illustrationStyle]
    ?? FALLBACK_STYLE_HINTS.storybook
  const band = deriveAgeBand(childAge)
  const isAdult = band === 'adult'
  const safetySuffix = config[`band_${band}_image_safety_suffix`]
    || (isAdult
      ? (config['adult_image_safety_suffix'] || 'Artistic illustration, tasteful, no explicit content, no text or words in image.')
      : (config['image_safety_suffix'] || 'Child-safe, no text, no words in image.'))
  const bandImageHint = config[`band_${band}_image_style_hint`] ?? ''
  return { styleHint, bandImageHint, safetySuffix }
}

interface GeneratedImage { bytes: Uint8Array; revisedPrompt: string | null; model: string }

/**
 * One DALL-E call for an already-assembled prompt (see visual.ts →
 * buildImagePrompt). Returns the bytes plus the provider's revised_prompt
 * (DALL-E 3 rewrites prompts; we store it per scene for debugging but never
 * treat it as authoritative over the visual bible).
 */
async function generateImage(prompt: string): Promise<GeneratedImage> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DALL-E error ${res.status}: ${err}`)
  }

  const json = await res.json()
  const imageUrl = json.data?.[0]?.url
  if (!imageUrl) throw new Error('DALL-E error: no image URL in response')
  const revisedPrompt = typeof json.data?.[0]?.revised_prompt === 'string' ? json.data[0].revised_prompt : null

  // Download immediately — OpenAI signed URLs expire within ~1 hour
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to download image from OpenAI URL: ${imageRes.status}`)
  }

  const buffer = await imageRes.arrayBuffer()
  return { bytes: new Uint8Array(buffer), revisedPrompt, model: IMAGE_MODEL }
}

/**
 * Resolve the story's visual bible: reuse the persisted one when it
 * validates, otherwise build it deterministically from the plan + request
 * (identical output for identical inputs) and persist it when the column
 * exists. `log` and `supabase` are passed in so both the main pipeline and
 * the images-only backfill share one code path.
 */
async function resolveVisualBible(args: {
  supabase: ReturnType<typeof createClient>
  requestId: string
  row: Record<string, unknown>
  plan: unknown
  config: ConfigMap
  workerId: string | null
  log: (stage: string, message: string, level?: 'info' | 'warning' | 'error', metadata?: Record<string, unknown>) => Promise<void>
}) {
  const { supabase, requestId, row, config } = args
  const persisted = validateVisualBible(row.visual_bible)
  if (row.visual_bible && persisted.ok) {
    await args.log('visual_bible_reused', 'Reusing persisted visual bible', 'info', {
      supporting_characters: persisted.bible.supporting_characters.length,
      recurring_objects: persisted.bible.protagonist.recurring_objects.length,
    })
    return persisted.bible
  }

  const pageCount = Number(row.story_length) || 16
  const planCheck = validateStoryPlan(args.plan, pageCount)
  const plan = planCheck.ok ? planCheck.plan : null
  const { styleHint } = imageConfigFor(config, String(row.illustration_style), Number(row.child_age))
  const bible = buildVisualBible({
    requestId,
    childName: String(row.child_name ?? ''),
    childAge: Number.isFinite(Number(row.child_age)) ? Number(row.child_age) : null,
    childDescription: (row.child_description as string | null) ?? null,
    supportingCharactersText: (row.supporting_characters as string | null) ?? null,
    illustrationStyle: String(row.illustration_style),
    styleHint,
    plan,
    consistencyRules: config['image_consistency_rules'] ?? null,
  })

  let update = supabase.from('story_requests').update({ visual_bible: bible }).eq('id', requestId)
  if (args.workerId) update = update.eq('worker_id', args.workerId)
  const { error } = await update
  await args.log('visual_bible_created', error
    ? `Visual bible built (not persisted: ${error.message} — apply migration 20240065)`
    : 'Visual bible built and persisted', error ? 'warning' : 'info', {
    from_plan: !!plan,
    supporting_characters: bible.supporting_characters.length,
    recurring_objects: bible.protagonist.recurring_objects.length,
    parent_visual_cue_count: bible.protagonist.parent_visual_cues.length,
    illustration_style: bible.art_direction.illustration_style,
    persisted: !error,
  })
  return bible
}

/**
 * Cover stage (Phase 1F). One front-cover image per story, built from the
 * SAME visual bible and plan as the interior, stored at
 * story-images/<id>/cover.png and recorded on generated_stories.
 *
 * Idempotent: a complete cover is always reused; the lease held by the
 * caller guarantees a single generator at a time. Failure is recoverable
 * and never touches scenes or completion — the book stays complete with
 * a typographic cover and the admin backfill (or the next run) retries.
 */
async function runCoverStage(args: {
  supabase: ReturnType<typeof createClient>
  requestId: string
  row: Record<string, unknown>
  bible: ReturnType<typeof buildVisualBible>
  plan: unknown
  config: ConfigMap
  skip: boolean
  source: 'pipeline' | 'backfill'
  /** True while the caller still holds the story's lease; every cover-state write is gated on it. */
  ownsLease: () => Promise<boolean>
  log: (stage: string, message: string, level?: 'info' | 'warning' | 'error', metadata?: Record<string, unknown>) => Promise<void>
}): Promise<'reused' | 'generated' | 'failed' | 'skipped' | 'stale'> {
  const { supabase, requestId, row, config, log } = args
  const stale = async (where: string) => {
    await log('cover_stale_worker', `Lease no longer held (${where}) — cover state left to the current worker`, 'warning', { source: args.source })
    return 'stale' as const
  }
  const { data: gs, error: gsErr } = await supabase
    .from('generated_stories')
    .select('id, cover_status, cover_storage_path, cover_attempts')
    .eq('request_id', requestId)
    .maybeSingle()
  if (gsErr) {
    await log('cover_skipped_schema', `Cover columns unavailable (${gsErr.message}) — apply migration 20240066 to enable covers`, 'warning')
    return 'skipped'
  }
  if (!gs) {
    await log('cover_skipped', 'No generated story row yet — cover not attempted', 'warning')
    return 'skipped'
  }

  const decision = shouldGenerateCover(gs, args.skip)
  if (decision === 'reuse') {
    await log('cover_reused', 'Existing cover reused', 'info', { source: args.source })
    return 'reused'
  }
  if (decision === 'skip') {
    await supabase.from('generated_stories').update({ cover_status: 'skipped' }).eq('id', gs.id)
    await log('cover_skipped', 'Cover skipped — image generation disabled (typographic cover will be used)', 'info', { source: args.source })
    return 'skipped'
  }

  const attempts = Number(gs.cover_attempts ?? 0) + 1
  if (!(await args.ownsLease())) return stale('before start')
  await supabase.from('generated_stories').update({ cover_status: 'generating', cover_attempts: attempts }).eq('id', gs.id)

  const planCheck = validateStoryPlan(args.plan, Number(row.story_length) || 16)
  const imgCfg = imageConfigFor(config, String(row.illustration_style), Number(row.child_age))
  const built = buildCoverPrompt({
    bible: args.bible,
    plan: planCheck.ok ? planCheck.plan : null,
    tones: row.story_tone as string[] | string | null,
    bandImageHint: imgCfg.bandImageHint,
    safetySuffix: imgCfg.safetySuffix,
  })
  await log(args.source === 'backfill' ? 'cover_backfill_started' : 'cover_generation_started', 'Generating cover artwork', 'info', {
    attempt: attempts,
    ...built.meta,
    visual_bible_reused: validateVisualBible(row.visual_bible).ok,
  })

  try {
    const image = await generateImage(built.prompt)
    const path = coverStoragePath(requestId)
    const { error: upErr } = await supabase.storage
      .from('story-images')
      .upload(path, image.bytes, { contentType: 'image/png', upsert: true })
    if (upErr) throw new Error(`Cover upload failed: ${upErr.message}`)
    if (!(await args.ownsLease())) return stale('after generation')
    await supabase.from('generated_stories').update({
      cover_storage_path: path,
      cover_status: 'complete',
      cover_model: image.model,
      cover_revised_prompt: image.revisedPrompt,
      cover_generated_at: new Date().toISOString(),
      cover_last_error: null,
    }).eq('id', gs.id)
    await log(args.source === 'backfill' ? 'cover_backfill_complete' : 'cover_generation_complete', 'Cover artwork stored', 'info', {
      attempt: attempts,
      model: image.model,
      prompt_length: built.meta.prompt_length,
      revised_prompt_captured: image.revisedPrompt !== null,
      storage_path: path,
    })
    return 'generated'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!(await args.ownsLease())) return stale('after failure')
    await supabase.from('generated_stories').update(coverFailureUpdate(msg, attempts)).eq('id', gs.id)
    await log('cover_generation_failed', `Cover generation failed (book stays complete with a typographic cover): ${msg.slice(0, 200)}`, 'warning', {
      attempt: attempts,
      prompt_length: built.meta.prompt_length,
      source: args.source,
    })
    return 'failed'
  }
}

// ── Quiz generator ────────────────────────────────────────────────────────────

async function generateQuiz(
  storyPages: { page: number; text: string }[],
  subject: string,
  grade: number,
  topic: string,
  config: ConfigMap = {},
): Promise<object[]> {
  const storyText = storyPages.map(p => `Page ${p.page}: ${p.text}`).join('\n')

  const quizSystemPrompt = config['quiz_system_prompt']
    ?? 'You are an educational assessment writer. Create 5 multiple-choice quiz questions based on the story and learning topic.'

  const quizRules = (config['quiz_rules'] ?? `Rules:
- Write exactly 5 questions
- Questions must be answerable from the story content
- Mix comprehension questions (about story events) with concept questions (about {topic})
- Keep language appropriate for grade {grade} (age {age_low}–{age_high})
- Each question must have exactly 4 options
- correct_index is 0-based (0 = first option, 3 = last option)
- Explanations should be encouraging and educational`)
    .replace(/\{topic\}/g, topic)
    .replace(/\{grade\}/g, String(grade))
    .replace(/\{age_low\}/g, String(5 + grade))
    .replace(/\{age_high\}/g, String(6 + grade))

  const messages = [
    {
      role: 'system',
      content: `${quizSystemPrompt}

Your output must be valid JSON matching this exact structure:
{
  "questions": [
    {
      "question": "string — the question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "string — brief explanation of why this answer is correct"
    }
  ]
}

${quizRules}`,
    },
    {
      role: 'user',
      content: `Story content:\n${storyText}\n\nLearning topic: ${topic} (${subject}, grade ${grade})\n\nGenerate 5 quiz questions now.`,
    },
  ]

  const { content } = await callOpenAI(messages)
  const parsed = JSON.parse(content)
  return parsed.questions
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  console.log('[process-story] invoked', req.method, new Date().toISOString())

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Application-level gate for EVERY mode (standard, continue, images_only,
  // sweep). Gateway JWT verification is disabled for this function
  // (supabase/config.toml: verify_jwt = false) because callers — the Next.js
  // app, this function's own continuation dispatch and the pg_cron sweep —
  // present the shared EDGE_FUNCTION_SECRET, not a Supabase JWT. Nothing
  // below runs until the bearer matches; an empty/missing expected token
  // refuses everyone.
  if (!isAuthorizedBearer(req.headers.get('Authorization'), EXPECTED_TOKEN)) {
    console.warn('[process-story] unauthorized — bearer rejected')
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  // Modes:
  //   (none) / 'continue' — process one request (claim → text → images → complete)
  //   'images_only'       — admin backfill of illustrations on a complete story
  //   'sweep'             — scheduler entry point: re-dispatch released / expired work
  let requestId: string
  let language = 'en'
  let mode: string | undefined
  try {
    const body = await req.json()
    requestId = body.requestId
    language = body.language === 'es' ? 'es' : 'en'
    mode = typeof body.mode === 'string' ? body.mode : undefined
    if (!requestId && mode !== 'sweep') throw new Error('Missing requestId')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  console.log('[process-story] requestId=', requestId ?? '-', 'mode=', mode ?? 'standard')

  // ── Supabase admin client ─────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Sweep (scheduler entry point) ─────────────────────────────────────────
  // Finds work that no worker currently owns — rows released at the time
  // budget whose chained invocation was lost, rows whose worker died (lease
  // expired), and queued rows whose initial trigger never arrived — and
  // dispatches a fresh invocation for each. Rows with no progress for
  // SWEEP_STALE_MS are failed with the existing classification so they stay
  // retryable and visible instead of sitting forever. The claim inside each
  // dispatched run is still the only thing that grants ownership, so a sweep
  // racing a live worker is harmless.
  if (mode === 'sweep') {
    const nowMs = Date.now()
    const graceIso = new Date(nowMs - SWEEP_GRACE_MS).toISOString()
    const { data: rows, error: rowsErr } = await supabase
      .from('story_requests')
      .select('id, status, worker_id, worker_lease_expires_at, updated_at')
      .in('status', ['queued', 'generating_text', 'generating_images'])
      .lt('updated_at', graceIso)
      .order('updated_at', { ascending: true })
      .limit(10)

    if (rowsErr) {
      return new Response(JSON.stringify({ mode: 'sweep', error: rowsErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    let dispatched = 0
    let autoFailed = 0
    let skipped = 0
    const dispatches: Promise<void>[] = []

    for (const row of rows ?? []) {
      if (isSweepStale(row, nowMs)) {
        const minutesIdle = Math.round((nowMs - new Date(row.updated_at).getTime()) / 60000)
        const reason = `No progress in ${row.status} for ${minutesIdle} minutes — auto-failed by sweep.`
        // Conditional on the same updated_at so we never clobber a worker
        // that just made progress.
        const { data: flipped } = await supabase
          .from('story_requests')
          .update({
            status: 'failed',
            worker_id: null,
            worker_lease_expires_at: null,
            last_error: reason,
            failure_code: 'EDGE_FUNCTION_TIMEOUT',
            failure_stage: row.status,
            retryable: true,
            status_message: 'Generation took too long. Please retry.',
          })
          .eq('id', row.id)
          .eq('updated_at', row.updated_at)
          .select('id')
          .maybeSingle()
        if (flipped) {
          autoFailed++
          await supabase.from('processing_logs').insert({
            request_id: row.id, level: 'warning', stage: 'sweep_auto_failed',
            message: reason, metadata: { previous_status: row.status, idle_minutes: minutesIdle },
          })
        }
        continue
      }

      if (!isSweepEligible(row, nowMs)) { skipped++; continue }

      dispatches.push((async () => {
        const result = await dispatchSelf({ requestId: row.id, mode: 'continue' })
        dispatched++
        await supabase.from('processing_logs').insert({
          request_id: row.id, level: result.ok ? 'info' : 'warning', stage: 'sweep_dispatched',
          message: result.ok
            ? `Sweep re-dispatched ${row.status} row (worker=${row.worker_id ? 'lease expired' : 'none'})`
            : `Sweep dispatch failed: ${result.error ?? `HTTP ${result.status}`}`,
          metadata: { previous_status: row.status, had_worker: row.worker_id !== null, dispatch: result },
        })
      })())
    }

    await Promise.all(dispatches)

    // Ready-email recovery: a worker that crashed between completion and
    // its callback (or whose callback failed twice) left a complete story
    // with no successful ready email. Re-invoke the callback for such rows
    // so delivery never depends on a browser poll. The callback is
    // idempotent (delivery_logs check + one-shot claim that is released on
    // failure), attempts are capped by readyEmailRecoveryCandidates, and
    // every outcome is logged.
    let emailRecovered = 0
    let emailCandidates = 0
    try {
      const windowIso = new Date(nowMs - READY_EMAIL_RECOVERY_WINDOW_MS).toISOString()
      const { data: completeRows } = await supabase
        .from('story_requests')
        .select('id, completed_at, user_email')
        .eq('status', 'complete')
        .not('user_email', 'is', null)
        .gt('completed_at', windowIso)
        .order('completed_at', { ascending: true })
        .limit(50)
      const ids = (completeRows ?? []).map(r => r.id)
      const { data: logs } = ids.length > 0
        ? await supabase
          .from('delivery_logs')
          .select('request_id, channel, status, email_type')
          .in('request_id', ids)
          .eq('channel', 'email')
        : { data: [] }
      const candidates = readyEmailRecoveryCandidates(completeRows ?? [], logs ?? [], nowMs).slice(0, 5)
      emailCandidates = candidates.length
      for (const id of candidates) {
        let outcome = ''
        try {
          const res = await fetch(`${APP_URL}/api/internal/story-completed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EXPECTED_TOKEN}` },
            body: JSON.stringify({ requestId: id }),
          })
          const body = await res.json().catch(() => ({}))
          outcome = res.ok ? String(body.status ?? 'ok') : `HTTP ${res.status}`
          if (res.ok && body.status === 'sent') emailRecovered++
        } catch (e) {
          outcome = e instanceof Error ? e.message : String(e)
        }
        await supabase.from('processing_logs').insert({
          request_id: id, level: outcome === 'sent' || outcome === 'already_sent' || outcome === 'already_claimed' ? 'info' : 'warning',
          stage: 'sweep_ready_email_recovery',
          message: `Sweep re-invoked the ready-email callback: ${outcome}`,
          metadata: { outcome },
        })
      }
    } catch (e) {
      console.error('[process-story] sweep ready-email recovery error', e instanceof Error ? e.message : String(e))
    }

    return new Response(
      JSON.stringify({ mode: 'sweep', scanned: rows?.length ?? 0, dispatched, autoFailed, skipped, emailCandidates, emailRecovered }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Images-only backfill (admin-triggered) ────────────────────────────────
  // Generates illustrations for an already-complete story whose scenes were
  // skipped (image_generation_enabled=false / SKIP_IMAGE_GENERATION) or
  // failed. Reuses generateImage() and the storage path conventions but does
  // NOT touch generated_stories text, does NOT regenerate scene prompts, and
  // keeps story_requests.status as 'complete' throughout. Concurrency is
  // gated by the same lease model as the pipeline: an atomic claim that
  // accepts a free OR expired lease, a heartbeat per page, and a release in
  // `finally` that only the owning backfill can perform. A crashed backfill
  // therefore becomes reclaimable after BACKFILL_LEASE_MS with no manual SQL.
  if (mode === 'images_only') {
    const { data: storyReq, error: reqErr } = await supabase
      .from('story_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    if (reqErr || !storyReq) {
      return new Response(JSON.stringify({ message: 'Story request not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }
    if (storyReq.status !== 'complete') {
      return new Response(JSON.stringify({ message: 'Story is not complete; standard generation flow handles images.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Atomic lease-aware claim — accept when no worker holds the row OR the
    // previous backfill's lease has expired. Status stays 'complete' so the
    // reader and ownership checks are unaffected.
    const lockId = crypto.randomUUID()
    const backfillNowIso = new Date().toISOString()
    const { data: claim } = await supabase
      .from('story_requests')
      .update({
        worker_id: lockId,
        worker_lease_expires_at: new Date(Date.now() + BACKFILL_LEASE_MS).toISOString(),
        worker_heartbeat_at: backfillNowIso,
        status_message: 'Generating illustrations…',
      })
      .eq('id', requestId)
      .eq('status', 'complete')
      .or(`worker_id.is.null,worker_lease_expires_at.lt.${backfillNowIso}`)
      .select('id')
      .maybeSingle()
    if (!claim) {
      return new Response(JSON.stringify({ message: 'Another image backfill is already running for this story.' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }

    const backfillReclaimed = storyReq.worker_id !== null
    await supabase.from('processing_logs').insert({
      request_id: requestId, level: 'info', stage: backfillReclaimed ? 'admin_image_backfill_reclaimed' : 'admin_image_backfill_start',
      message: backfillReclaimed ? 'admin image backfill reclaimed an expired backfill lease' : 'admin image backfill started',
      metadata: { worker_id: lockId, lease_ms: BACKFILL_LEASE_MS },
    })

    // Lease helpers — conditional on our own worker_id so a backfill whose
    // lease was reclaimed can neither extend nor release the new owner's.
    const backfillHeartbeat = async () => {
      await supabase
        .from('story_requests')
        .update({ worker_heartbeat_at: new Date().toISOString(), worker_lease_expires_at: new Date(Date.now() + BACKFILL_LEASE_MS).toISOString() })
        .eq('id', requestId)
        .eq('worker_id', lockId)
    }
    const backfillOwnsLease = async () => {
      const { data } = await supabase.from('story_requests').select('worker_id').eq('id', requestId).maybeSingle()
      return data?.worker_id === lockId
    }
    const releaseBackfillLease = async (message: string) => {
      const { data } = await supabase
        .from('story_requests')
        .update({ worker_id: null, worker_lease_expires_at: null, status_message: message })
        .eq('id', requestId)
        .eq('worker_id', lockId)
        .select('id')
        .maybeSingle()
      return !!data
    }

    const backfillLog = async (stage: string, message: string, level: 'info' | 'warning' | 'error' = 'info', metadata: Record<string, unknown> = {}) => {
      await supabase.from('processing_logs').insert({ request_id: requestId, level, stage, message, metadata: { worker_id: lockId, ...metadata } })
    }

    let generated = 0
    let failed = 0
    let coverResult: string = 'skipped'
    let missingCount = 0
    let totalScenes = 0
    try {

    // Fetch missing scenes
    const { data: scenes } = await supabase
      .from('story_scenes')
      .select('id, page_number, image_prompt, image_status, storage_path, generation_attempts')
      .eq('request_id', requestId)
      .order('page_number', { ascending: true })

    const missing = (scenes ?? []).filter(s => s.image_status !== 'complete' || !s.storage_path)
    totalScenes = (scenes ?? []).length
    missingCount = missing.length
    const completedBefore = totalScenes - missing.length

    // Fetch ai_writer_config for image style hints
    const cfgMap: ConfigMap = {}
    try {
      const { data: cfgRows } = await supabase.from('ai_writer_config').select('key, value')
      for (const row of cfgRows ?? []) cfgMap[row.key] = row.value
    } catch (_) { /* fail open */ }

    // Same visual bible and prompt assembly as the main pipeline, so a
    // backfilled page matches the pages drawn in the original run.
    const backfillBible = await resolveVisualBible({ supabase, requestId, row: storyReq, plan: storyReq.story_plan, config: cfgMap, workerId: lockId, log: backfillLog })
    const backfillPlan = validateStoryPlan(storyReq.story_plan, Number(storyReq.story_length) || 16)
    const backfillImageCfg = imageConfigFor(cfgMap, String(storyReq.illustration_style), Number(storyReq.child_age))

    for (const scene of missing) {
      await backfillHeartbeat()
      if (!(await backfillOwnsLease())) {
        await backfillLog('admin_image_backfill_lease_lost', 'Backfill lease reclaimed by another worker — stopping without writing', 'warning')
        break
      }
      try {
        const built = buildImagePrompt({
          bible: backfillBible,
          pageNumber: scene.page_number as number,
          imageDescription: scene.image_prompt as string,
          planPage: findPlanPage(backfillPlan.ok ? backfillPlan.plan : null, scene.page_number as number),
          bandImageHint: backfillImageCfg.bandImageHint,
          safetySuffix: backfillImageCfg.safetySuffix,
        })
        const image = await generateImage(built.prompt)
        const path = `${requestId}/${scene.page_number}.png`
        const { error: upErr } = await supabase.storage
          .from('story-images')
          .upload(path, image.bytes, { contentType: 'image/png', upsert: true })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        await supabase.from('story_scenes')
          .update({
            storage_path: path,
            image_status: 'complete',
            image_model: image.model,
            image_revised_prompt: image.revisedPrompt,
            generation_attempts: Number(scene.generation_attempts ?? 0) + 1,
          })
          .eq('id', scene.id)
        generated++
        await backfillLog('admin_image_backfill_page', `Page ${scene.page_number} illustrated`, 'info', {
          page_number: scene.page_number,
          ...built.meta,
          revised_prompt_captured: image.revisedPrompt !== null,
        })
        await supabase.from('story_requests').update({
          status_message: `Generating illustrations… (${completedBefore + generated} of ${totalScenes})`,
        }).eq('id', requestId)
      } catch (e) {
        failed++
        const msg = e instanceof Error ? e.message : String(e)
        await supabase.from('story_scenes').update({ image_status: 'failed' }).eq('id', scene.id)
        await supabase.from('processing_logs').insert({
          request_id: requestId, level: 'warning', stage: 'admin_image_backfill_failed_scene',
          message: `Page ${scene.page_number}: ${msg}`, metadata: { worker_id: lockId, page_number: scene.page_number },
        })
      }
    }

    // Cover backfill — same bible, plan and prompt builder as the pipeline,
    // so an admin-triggered cover matches the interior. Reuses a complete one.
    await backfillHeartbeat()
    coverResult = await runCoverStage({
      supabase,
      requestId,
      row: storyReq,
      bible: backfillBible,
      plan: storyReq.story_plan,
      config: cfgMap,
      skip: false,
      source: 'backfill',
      ownsLease: backfillOwnsLease,
      log: backfillLog,
    })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await backfillLog('admin_image_backfill_error', `admin image backfill aborted: ${msg.slice(0, 200)}`, 'error')
      throw e
    } finally {
      // Release the lease (own worker only) on success AND on error; restore
      // the friendly complete message. A crash that skips even this is
      // covered by lease expiry.
      const released = await releaseBackfillLease('Your story is ready!')
      await supabase.from('processing_logs').insert({
        request_id: requestId, level: 'info', stage: 'admin_image_backfill_complete',
        message: `admin image backfill finished — generated ${generated}/${missingCount}, failed ${failed}`,
        metadata: { worker_id: lockId, generated, failed, total_scenes: totalScenes, lease_released: released },
      })
    }

    return new Response(JSON.stringify({
      requestId,
      mode: 'images_only',
      generated,
      failed,
      missingBefore: missingCount,
      totalScenes,
      cover: coverResult,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  // ── End images-only backfill ──────────────────────────────────────────────

  // ── Fetch the full story request ──────────────────────────────────────────
  const { data: storyRequest, error: fetchError } = await supabase
    .from('story_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !storyRequest) {
    return new Response('Story request not found', { status: 404 })
  }

  // ── Fast-path skip ────────────────────────────────────────────────────────
  // Cheap pre-check before we attempt the atomic claim: if another worker is
  // visibly mid-pipeline, return immediately. The atomic UPDATE below is the
  // real source of truth — this just saves an extra round trip.
  // generating_text is claimable too: a worker that died mid-text leaves the
  // row there with an expired lease, and the lease predicate below is what
  // actually decides whether we may take it over.
  const claimableStatuses = CLAIMABLE_STATUSES
  if (storyRequest.worker_id !== null && !claimableStatuses.includes(storyRequest.status)) {
    return new Response(
      JSON.stringify({ requestId, skipped: true, reason: 'Already processing' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Check for existing work (checkpoint / resume detection) ───────────────
  const { data: existingStoryCheck } = await supabase
    .from('generated_stories')
    .select('id')
    .eq('request_id', requestId)
    .maybeSingle()

  const { data: existingSceneCheck } = await supabase
    .from('story_scenes')
    .select('id')
    .eq('request_id', requestId)
    .limit(1)

  // Resume only when both the story text AND its scenes are already saved.
  // If only generated_stories exists (scenes missing), regenerate both cleanly.
  const isResume = !!existingStoryCheck?.id && (existingSceneCheck?.length ?? 0) > 0

  // ── Atomic lease-aware claim ─────────────────────────────────────────────
  // The conditional UPDATE wins when EITHER no worker holds the row OR the
  // existing lease has expired. Combined with the unique row + atomic
  // UPDATE this remains race-safe: two workers can't both succeed.
  //
  // Lease window is 2 minutes — comfortably longer than any single image
  // generation but short enough that a crashed worker can be reclaimed
  // quickly. The Edge Function refreshes the lease via heartbeat() on
  // every image loop iteration so long runs don't time themselves out.
  const workerId = crypto.randomUUID()
  const LEASE_MS = 2 * 60 * 1000
  // Lease held across each long text-stage call (plan, then book). Refreshed
  // between stages; the Edge Function wall-clock limit still bounds a call.
  const TEXT_STAGE_LEASE_MS = 4 * 60 * 1000
  // If the plan stage alone used more than this much of the invocation,
  // hand the book stage to a fresh invocation (plan is checkpointed) rather
  // than risk the wall-clock limit mid-prose.
  const TEXT_HANDOFF_MS = 55_000
  const leaseExpiresIso = new Date(Date.now() + LEASE_MS).toISOString()
  const nowIso = new Date().toISOString()
  const reclaiming = storyRequest.worker_id !== null

  const { data: claim } = await supabase
    .from('story_requests')
    .update({
      worker_id: workerId,
      worker_lease_expires_at: leaseExpiresIso,
      worker_heartbeat_at: nowIso,
      status: isResume ? 'generating_images' : 'generating_text',
      ...(!isResume ? { processing_started_at: new Date().toISOString() } : {}),
      status_message: isResume ? 'Resuming illustrations…' : 'Writing your story…',
      progress_pct: monotonicProgress(storyRequest.progress_pct, isResume ? 45 : 10),
      last_error: null,
    })
    .eq('id', requestId)
    // Accept rows where there's no worker, OR the lease has expired.
    .or(`worker_id.is.null,worker_lease_expires_at.lt.${nowIso}`)
    .in('status', claimableStatuses)
    .select('id')
    .maybeSingle()

  if (!claim) {
    console.log('[process-story] claim lost — another worker holds the lock', requestId)
    return new Response(
      JSON.stringify({ requestId, skipped: true, reason: 'Claim lost (concurrent worker)' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Heartbeat — call from inside long stages to refresh the lease.
  // Conditional on worker_id matching ours so a stale worker that
  // tries to extend after being reclaimed is a no-op.
  async function heartbeat(leaseMs: number = LEASE_MS) {
    const next = new Date(Date.now() + leaseMs).toISOString()
    await supabase
      .from('story_requests')
      .update({ worker_heartbeat_at: new Date().toISOString(), worker_lease_expires_at: next })
      .eq('id', requestId)
      .eq('worker_id', workerId)
  }

  // True while this invocation still owns the row. Used before writing the
  // result of a long external call, so a worker whose lease was reclaimed
  // (and whose row may now belong to another invocation) never overwrites
  // the live worker's progress.
  async function stillOwnsLease(): Promise<boolean> {
    const { data } = await supabase
      .from('story_requests')
      .select('worker_id')
      .eq('id', requestId)
      .maybeSingle()
    return data?.worker_id === workerId
  }

  // Worker start time — used to enforce the time budget
  const workerStart = Date.now()

  // Audit trail entry for the claim. lease_reclaimed is the more
  // interesting signal — it means a previous worker died and we
  // re-grabbed the row.
  await supabase.from('processing_logs').insert({
    request_id: requestId,
    level: 'info',
    stage: reclaiming ? 'lease_reclaimed' : 'lease_acquired',
    message: reclaiming
      ? `Reclaimed expired lease (worker=${workerId.slice(0, 8)})`
      : `Lease acquired (worker=${workerId.slice(0, 8)})`,
    metadata: { worker_id: workerId, lease_ms: LEASE_MS },
  })

  // Track the last pipeline stage we entered so the catch-block
  // classifier can attribute the failure correctly.
  let currentStage = 'queued'

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Normalize a thrown error + active stage into the failure classification
   * stored on story_requests. Pure function — no I/O.
   */
  function classifyFailure(err: unknown, stage: string): { code: string; stage: string; retryable: boolean } {
    const raw = err instanceof Error ? err.message : String(err)
    const m = raw.toLowerCase()

    // Two-stage text generation: structural validation failed even after
    // the bounded in-run repair. Model output varies run to run, so these
    // stay retryable (see lib/limits/retryRules.ts for the ladder).
    if (m.includes('story plan invalid')) return { code: 'STORY_PLAN_INVALID', stage: 'generating_text', retryable: true }
    if (m.includes('story text invalid')) return { code: 'STORY_TEXT_INVALID', stage: 'generating_text', retryable: true }

    // Hard, non-retryable cases first.
    if (m.includes('invalid') && (m.includes('payload') || m.includes('input') || m.includes('schema'))) {
      return { code: 'INVALID_INPUT', stage, retryable: false }
    }
    if (m.includes('unauthorized') || m.includes('forbidden') || m.includes('not authorized')) {
      return { code: 'AUTH_ERROR', stage, retryable: false }
    }

    // Provider-specific transient errors — retryable.
    if (m.includes('rate limit') || m.includes('429')) return { code: 'RATE_LIMIT', stage, retryable: true }
    if (m.includes('timed out') || m.includes('timeout')) {
      if (stage === 'generating_images') return { code: 'IMAGE_TIMEOUT', stage, retryable: true }
      if (stage === 'generating_text')   return { code: 'OPENAI_TIMEOUT', stage, retryable: true }
      return { code: 'EDGE_FUNCTION_TIMEOUT', stage, retryable: true }
    }
    if (m.includes('image') && (m.includes('failed') || m.includes('error'))) {
      return { code: 'IMAGE_GENERATION_FAILED', stage: 'generating_images', retryable: true }
    }
    if (m.includes('openai') || m.includes('chat completion')) {
      return { code: 'OPENAI_ERROR', stage: stage === 'queued' ? 'generating_text' : stage, retryable: true }
    }
    if (m.includes('storage') || m.includes('upload') || m.includes('bucket')) {
      return { code: 'STORAGE_ERROR', stage, retryable: true }
    }
    if (stage === 'assembling_pdf') {
      return { code: 'PDF_ASSEMBLY_FAILED', stage, retryable: true }
    }
    return { code: 'UNKNOWN', stage, retryable: true }
  }


  async function setStatus(
    status: string,
    message: string,
    progress: number,
    extra: Record<string, unknown> = {}
  ) {
    currentStage = status
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
    await log(
      'pipeline_start',
      isResume
        ? 'Pipeline resumed (checkpoint — continuing from prior run)'
        : MOCK_PIPELINE
          ? 'Pipeline started (MOCK MODE — no API calls)'
          : 'Pipeline started'
    )

    // ── Fetch AI writer config ──────────────────────────────────────────
    const configMap: ConfigMap = {}
    try {
      const { data: configRows } = await supabase
        .from('ai_writer_config')
        .select('key, value')
      for (const row of configRows ?? []) {
        configMap[row.key] = row.value
      }
      await log('config', `Loaded ${Object.keys(configMap).length} config keys`)
    } catch (configErr) {
      await log('config', `Config fetch failed, using defaults: ${configErr}`, 'warning')
    }

    // ── Mock mode — skips all OpenAI calls, uses canned data ─────────────
    if (MOCK_PIPELINE) {
      const pageCount = Number(storyRequest.story_length) || 8
      const mockPages = Array.from({ length: pageCount }, (_, i) => ({
        page: i + 1,
        text: `This is mock page ${i + 1} of ${pageCount} for ${storyRequest.child_name}'s story. No API credits were used.`,
        image_description: `A friendly scene for page ${i + 1}.`,
      }))

      const { data: mockSaved, error: mockErr } = await supabase
        .from('generated_stories')
        .upsert({
          request_id: requestId,
          title: `${storyRequest.child_name}'s Mock Story`,
          subtitle: 'A test story',
          author_line: 'A Nest & Quill Original',
          dedication: storyRequest.dedication_text || null,
          synopsis: 'A mock story generated for local testing — no OpenAI credits used.',
          full_text_json: mockPages,
          model_used: 'mock',
          generation_time_ms: 0,
        }, { onConflict: 'request_id' })
        .select('id')
        .single()

      if (mockErr || !mockSaved) throw new Error(`Mock story insert failed: ${mockErr?.message}`)

      await supabase.from('story_scenes').delete().eq('request_id', requestId)

      const mockScenes = mockPages.map(p => ({
        story_id: mockSaved.id,
        request_id: requestId,
        page_number: p.page,
        page_text: p.text,
        image_prompt: p.image_description,
        image_status: 'pending',
      }))

      await supabase.from('story_scenes').insert(mockScenes)

      await supabase
        .from('story_requests')
        .update({
          status: 'complete',
          status_message: 'Mock story ready!',
          progress_pct: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      await log('pipeline_complete', 'Mock pipeline complete — no API calls made')

      return new Response(
        JSON.stringify({ requestId, status: 'complete', title: `${storyRequest.child_name}'s Mock Story`, mock: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Step 1: Story text ────────────────────────────────────────────────
    // story holds the minimal shape needed by later steps (title, pages, dedication).
    let story: Record<string, unknown> = {}
    let savedStory: { id: string }
    // The validated story plan from this run (fresh path). Resumed runs read
    // the persisted plan from the row instead. Used by the image stage so the
    // visual bible and per-page continuity come from the same plan the book
    // was written from.
    let textPlan: unknown = null

    if (isResume) {
      // Reuse the story that was already generated and saved — no OpenAI call.
      const { data: gs, error: gsErr } = await supabase
        .from('generated_stories')
        .select('id, title, subtitle, full_text_json, dedication')
        .eq('request_id', requestId)
        .single()

      if (gsErr || !gs) throw new Error(`Failed to fetch existing story for resume: ${gsErr?.message}`)

      savedStory = { id: gs.id }
      story = { title: gs.title, subtitle: gs.subtitle, pages: gs.full_text_json, dedication: gs.dedication }

      await log('resumed_existing_story', `Reusing existing story "${gs.title}" — skipped text generation`, 'info', {
        story_id: gs.id,
      })
    } else {
      // Fresh run — two-stage text generation (Phase 1C).
      //   Stage 1  story plan: outline + one beat per page, validated, then
      //            checkpointed on story_requests.story_plan
      //   Stage 2  final book written FROM the plan, validated against the
      //            same downstream contract (title + pages[{page, text,
      //            image_description}]) the scenes and reader already use
      // Each stage gets at most MAX_STAGE_ATTEMPTS model calls (one attempt
      // plus one bounded repair). Metadata records WHICH personalization
      // inputs shaped the prompts (field names only) — never the values.
      const pageCountWanted = Number(storyRequest.story_length) || 16
      await log('generate_text', 'Starting two-stage text generation (plan → book)', 'info', {
        personalization_fields_used: personalizationFieldsUsed(storyRequest),
        page_count: pageCountWanted,
      })
      const t0 = Date.now()

      // Shared bounded loop: call → parse → validate → (one repair) → throw.
      // Returns the validated value plus per-stage usage telemetry.
      async function generateJsonWithRepair(
        label: 'story plan' | 'book',
        messages: { role: string; content: string }[],
        validate: (raw: unknown, attempt: number) => { ok: true; value: unknown } | { ok: false; errors: string[] },
        temperature: number,
      ) {
        let convo = messages
        let lastErrors: string[] = []
        let attempts = 0
        let model = TEXT_MODEL
        const acc = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, missing: false }
        const started = Date.now()
        while (attempts < MAX_STAGE_ATTEMPTS) {
          attempts++
          const res = await callOpenAI(convo, TEXT_MODEL, temperature)
          model = res.model
          for (const k of ['prompt_tokens', 'completion_tokens', 'total_tokens'] as const) {
            if (res.usage[k] === null) acc.missing = true
            else acc[k] += res.usage[k] as number
          }
          const parsed = safeParseJson(res.content)
          const result = parsed.ok ? validate(parsed.value, attempts) : { ok: false as const, errors: [parsed.error] }
          if (result.ok) {
            return {
              value: result.value,
              usage: {
                prompt_tokens: acc.missing ? null : acc.prompt_tokens,
                completion_tokens: acc.missing ? null : acc.completion_tokens,
                total_tokens: acc.missing ? null : acc.total_tokens,
                ms: Date.now() - started,
                attempts,
                model,
              },
            }
          }
          lastErrors = result.errors
          // Logs carry signal names only (the part before ':'), never the
          // story text or quoted fragments the repair prompt may contain.
          const signals = [...new Set(lastErrors.map(e => e.split(':')[0].trim()))].slice(0, 12)
          await log(
            label === 'story plan' ? 'plan_repair' : 'book_repair',
            `${label} failed validation on attempt ${attempts} (${signals.join(', ')})`,
            'warning',
            { attempt: attempts, signals, error_count: lastErrors.length, will_retry: attempts < MAX_STAGE_ATTEMPTS },
          )
          if (attempts < MAX_STAGE_ATTEMPTS) convo = buildRepairMessages(convo, res.content, lastErrors, label)
        }
        // Classified by classifyFailure() as STORY_PLAN_INVALID / STORY_TEXT_INVALID (retryable).
        throw new Error(`Story ${label === 'story plan' ? 'plan' : 'text'} invalid after ${attempts} attempts: ${lastErrors.slice(0, 6).join('; ')}`)
      }

      // ── Stage 1: story plan (reuse the checkpoint when a previous run left one) ──
      await heartbeat(TEXT_STAGE_LEASE_MS)
      await setStatus('generating_text', 'Planning the story…', 15)

      let plan: Record<string, unknown> & { title: string; pages: unknown[] }
      let planUsage: Record<string, unknown> | null = null
      const existingPlan = validateStoryPlan(storyRequest.story_plan, pageCountWanted)
      if (storyRequest.story_plan && existingPlan.ok) {
        plan = existingPlan.plan as typeof plan
        textPlan = plan
        planUsage = (storyRequest.generation_usage?.plan as Record<string, unknown> | undefined) ?? null
        await log('plan_reused', 'Reusing checkpointed story plan from a previous run — no plan call made', 'info', {
          beats: plan.pages.length,
        })
      } else {
        const planGen = await generateJsonWithRepair(
          'story plan',
          buildPlanPrompt(storyRequest, configMap, language),
          (raw) => { const v = validateStoryPlan(raw, pageCountWanted); return v.ok ? { ok: true, value: v.plan } : v },
          0.7,
        )
        if (!(await stillOwnsLease())) {
          throw new Error('Lease lost during story planning — another worker owns this request')
        }
        plan = planGen.value as typeof plan
        textPlan = plan
        planUsage = planGen.usage
        const phaseCounts: Record<string, number> = {}
        for (const b of plan.pages as { phase: string }[]) phaseCounts[b.phase] = (phaseCounts[b.phase] ?? 0) + 1
        await log('plan_generated', `Story plan ready: "${plan.title}" (${plan.pages.length} beats)`, 'info', {
          title: plan.title,
          beats: plan.pages.length,
          phases: phaseCounts,
          usage: planGen.usage,
        })

        // Checkpoint the plan so an interrupted worker never pays for it twice.
        // Tolerates the column being absent (migration 20240063 not applied).
        const { error: planErr } = await supabase
          .from('story_requests')
          .update({ story_plan: plan, generation_usage: { plan: planUsage } })
          .eq('id', requestId)
          .eq('worker_id', workerId)
        const planPersisted = !planErr
        if (planErr) {
          await log('plan_checkpoint_skipped', `story_plan not persisted (${planErr.message}) — apply migration 20240063 to enable plan checkpoints`, 'warning')
        }

        // Hand the book stage to a fresh invocation when planning consumed a
        // large share of this invocation's wall clock. Same mechanism as the
        // image-loop continuation: release (own worker only) + self-dispatch;
        // the next run claims, finds the checkpointed plan and skips Stage 1.
        const elapsedAfterPlan = Date.now() - workerStart
        if (planPersisted && elapsedAfterPlan > TEXT_HANDOFF_MS) {
          await supabase
            .from('story_requests')
            .update({
              worker_id: null,
              worker_lease_expires_at: null,
              status: 'generating_text',
              status_message: 'Story planned — writing the pages…',
              progress_pct: 25,
            })
            .eq('id', requestId)
            .eq('worker_id', workerId)
          await log('continuation_scheduled', `Plan stage used ${Math.round(elapsedAfterPlan / 1000)}s — handing the book stage to a fresh invocation`)
          const dispatch = await dispatchSelf({ requestId, language, mode: 'continue' })
          await log(
            'continuation_dispatched',
            dispatch.ok
              ? `Continuation invocation dispatched${dispatch.status ? ` (HTTP ${dispatch.status})` : ''}`
              : `Continuation dispatch failed — sweep will retry: ${dispatch.error ?? `HTTP ${dispatch.status}`}`,
            dispatch.ok ? 'info' : 'warning',
            { dispatch },
          )
          return new Response(
            JSON.stringify({ requestId, status: 'continuation', stage: 'plan_complete' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      // ── Stage 2: final book from the plan ───────────────────────────────
      await heartbeat(TEXT_STAGE_LEASE_MS)
      await setStatus('generating_text', 'Writing the pages…', 25)

      // Quality layer (Phase 1D): structural validation stays a hard gate;
      // deterministic prose signals ride the same bounded repair. On the
      // final attempt a structurally valid book is accepted even if quality
      // errors remain, and those are logged as unresolved — never thrown.
      const bookAgeBand = deriveAgeBand(Number(storyRequest.child_age))
      let qualityWarnings: string[] = []
      let qualityUnresolved: string[] = []
      let qualityRepairRequested = false
      const bookGen = await generateJsonWithRepair(
        'book',
        buildBookPrompt(storyRequest, plan as never, configMap, language),
        (raw, attempt) => {
          const v = validateBook(raw, pageCountWanted)
          if (!v.ok) return v
          const q = assessBookQuality(v.book, { ageBand: bookAgeBand, pageCount: pageCountWanted })
          qualityWarnings = q.warnings.map(w => w.code)
          if (q.errors.length > 0 && attempt < MAX_STAGE_ATTEMPTS) {
            qualityRepairRequested = true
            return { ok: false, errors: q.errors.map(e => `${e.code}: ${e.message}`) }
          }
          qualityUnresolved = q.errors.map(e => e.code)
          return { ok: true, value: v.book }
        },
        0.8,
      )
      const generationTimeMs = Date.now() - t0

      await log(
        'book_quality',
        qualityUnresolved.length > 0
          ? `Book accepted with unresolved quality signals (${qualityUnresolved.join(', ')})`
          : qualityRepairRequested
            ? 'Book quality repair succeeded'
            : qualityWarnings.length > 0
              ? `Book passed quality gate with warnings (${qualityWarnings.join(', ')})`
              : 'Book passed quality gate',
        qualityUnresolved.length > 0 ? 'warning' : 'info',
        {
          warnings: qualityWarnings,
          unresolved: qualityUnresolved,
          repair_requested: qualityRepairRequested,
          repair_outcome: qualityRepairRequested ? (qualityUnresolved.length > 0 ? 'unresolved' : 'resolved') : 'not_needed',
          attempts: bookGen.usage.attempts,
          age_band: bookAgeBand,
        },
      )

      if (!(await stillOwnsLease())) {
        throw new Error('Lease lost during text generation — another worker owns this request')
      }

      const book = bookGen.value as { title: string; subtitle: string; author_line: string; dedication: string; synopsis: string; pages: { page: number; text: string; image_description: string }[] }
      story = {
        title: book.title,
        subtitle: book.subtitle,
        author_line: book.author_line,
        dedication: book.dedication,
        synopsis: book.synopsis,
        pages: book.pages,
      }

      const stageUsage = { plan: planUsage, book: bookGen.usage }
      const totals = sumUsage([planUsage, bookGen.usage].filter(Boolean) as never)

      await log('generate_text', `Story generated: "${story.title}" (${book.pages.length} pages, ${generationTimeMs}ms)`, 'info', {
        title: story.title,
        page_count: book.pages.length,
        generation_time_ms: generationTimeMs,
        plan_usage: planUsage,
        book_usage: bookGen.usage,
        total_prompt_tokens: totals.prompt_tokens,
        total_completion_tokens: totals.completion_tokens,
      })

      // Per-stage telemetry on the request row (tolerates the column being absent).
      const { error: usageErr } = await supabase
        .from('story_requests')
        .update({ generation_usage: stageUsage })
        .eq('id', requestId)
        .eq('worker_id', workerId)
      if (usageErr) {
        await log('usage_persist_skipped', `generation_usage not persisted (${usageErr.message}) — apply migration 20240063`, 'warning')
      }

      // Upsert so a re-run after a crash between text-save and scene-insert stays clean
      const { data: gs, error: storyInsertError } = await supabase
        .from('generated_stories')
        .upsert({
          request_id: requestId,
          title: story.title,
          subtitle: story.subtitle || null,
          author_line: storyRequest.author_name || (story.author_line as string) || 'A Nest & Quill Original',
          dedication: story.dedication || null,
          synopsis: story.synopsis || null,
          full_text_json: story.pages,
          model_used: bookGen.usage.model ?? TEXT_MODEL,
          prompt_tokens: totals.prompt_tokens,
          completion_tokens: totals.completion_tokens,
          generation_time_ms: generationTimeMs,
        }, { onConflict: 'request_id' })
        .select('id')
        .single()

      if (storyInsertError || !gs) {
        throw new Error(`Failed to save story: ${storyInsertError?.message}`)
      }

      savedStory = { id: gs.id }

      // Delete any scenes from an aborted prior run, then insert fresh ones
      await supabase.from('story_scenes').delete().eq('request_id', requestId)

      // The only path from generation output to what the reader sees —
      // nothing from the story plan is included (it stays internal).
      const sceneRows = toSceneRows(book, { storyId: savedStory.id, requestId })

      const { error: scenesInsertError } = await supabase
        .from('story_scenes')
        .insert(sceneRows)

      if (scenesInsertError) {
        throw new Error(`Failed to save story scenes: ${scenesInsertError.message}`)
      }

      await setStatus('generating_text', 'Story written!', 40)

      // ── Step 1b: Generate quiz (learning mode only) ─────────────────────
      if (storyRequest.learning_mode && storyRequest.learning_subject && storyRequest.learning_topic) {
        try {
          await log('generate_quiz', `Generating quiz for topic: ${storyRequest.learning_topic}`)

          const quizQuestions = await generateQuiz(
            story.pages as { page: number; text: string }[],
            storyRequest.learning_subject as string,
            (storyRequest.learning_grade as number) ?? 1,
            storyRequest.learning_topic as string,
            configMap,
          )

          const { error: quizInsertError } = await supabase
            .from('story_quizzes')
            .insert({
              request_id: requestId,
              subject: storyRequest.learning_subject,
              grade: storyRequest.learning_grade ?? null,
              topic: storyRequest.learning_topic,
              questions: quizQuestions,
            })

          if (quizInsertError) {
            await log('generate_quiz', `Quiz insert warning: ${quizInsertError.message}`, 'warning')
          } else {
            await log('generate_quiz', `Quiz generated: ${quizQuestions.length} questions`)
          }
        } catch (quizErr) {
          const quizMsg = quizErr instanceof Error ? quizErr.message : String(quizErr)
          await log('generate_quiz', `Quiz generation failed (non-fatal): ${quizMsg}`, 'warning')
        }
      }
    }

    // ── Step 2: Generate illustrations via DALL-E 3 ───────────────────────
    await setStatus('generating_images', 'Creating illustrations…', 45)

    // Read image_generation_enabled from app_settings at runtime (DB-driven,
    // no redeploy needed).
    //
    // Effective rule:
    //   images = !SKIP_IMAGES env
    //         && image_generation_enabled (defaults to true if missing)
    //
    // beta_mode_enabled deliberately plays no part here: beta governs limits
    // and messaging, not whether the product generates its illustrations.
    // image_generation_enabled is the operator switch for pausing images.
    let imageGenEnabled = true
    try {
      const { data: rows } = await supabase
        .from('app_settings')
        .select('key, value')
        .eq('key', 'image_generation_enabled')
      for (const r of (rows ?? [])) {
        if (r.key === 'image_generation_enabled') imageGenEnabled = r.value !== false
      }
    } catch { /* fail open — proceed with real images */ }

    let imagesGenerated = 0
    let imagesFailed = 0
    // Longest DALL-E round trip measured in THIS invocation — feeds the
    // cover's start guard so a slow day never starts a call the hard limit
    // would kill.
    let longestImageMs: number | null = null

    const skipImages = shouldSkipImages({ skipEnv: SKIP_IMAGES, imageGenEnabled })
    if (skipImages.skip) {
      await log('generate_images', `Image generation skipped (${skipImages.reason})`)
    } else {
      const { data: allScenes, error: sceneFetchError } = await supabase
        .from('story_scenes')
        .select('id, page_number, image_prompt, image_status, storage_path, generation_attempts')
        .eq('request_id', requestId)
        .order('page_number', { ascending: true })

      if (sceneFetchError || !allScenes) {
        throw new Error(`Failed to fetch story scenes: ${sceneFetchError?.message}`)
      }

      // ── Visual bible (once per story, reused by every page / continuation) ──
      // Fresh runs have the plan in memory; resumed runs read the persisted
      // plan from the row. Either way the bible is deterministic for the
      // same inputs, and a persisted bible always wins.
      const planSource = textPlan ?? storyRequest.story_plan
      const visualBible = await resolveVisualBible({
        supabase,
        requestId,
        row: storyRequest,
        plan: planSource,
        config: configMap,
        workerId,
        log,
      })
      const planForImagesCheck = validateStoryPlan(planSource, Number(storyRequest.story_length) || 16)
      const planForImages = planForImagesCheck.ok ? planForImagesCheck.plan : null
      const imageCfg = imageConfigFor(configMap, String(storyRequest.illustration_style), Number(storyRequest.child_age))

      const totalScenes = allScenes.length
      const completedBefore = allScenes.filter(s => s.image_status === 'complete').length
      const pendingScenes = allScenes.filter(s => s.image_status === 'pending' || s.image_status === 'failed')

      if (isResume && completedBefore > 0) {
        await log('skipped_completed_scene', `Resuming: ${completedBefore}/${totalScenes} scenes already complete, ${pendingScenes.length} remaining`, 'info', {
          completed_before: completedBefore,
          pending_count: pendingScenes.length,
          total_scenes: totalScenes,
        })
      }

      for (const scene of pendingScenes) {
        // Heartbeat — refresh the lease before each scene so a long
        // run doesn't get reclaimed by a stuck-job sweeper while it's
        // still actively working.
        await heartbeat()

        // ── Time budget check ─────────────────────────────────────────────
        // Evaluated BEFORE each DALL-E call so we never start an image we
        // cannot finish within the Edge Function wall-clock limit.
        const elapsed = Date.now() - workerStart
        if (elapsed >= TIME_BUDGET_MS) {
          const completedNow = completedBefore + imagesGenerated
          await log(
            'time_budget_reached',
            `Time budget (${TIME_BUDGET_MS / 1000}s) reached after ${Math.round(elapsed / 1000)}s — ${completedNow}/${totalScenes} images complete`,
            'info',
            {
              elapsed_ms: elapsed,
              images_generated_this_run: imagesGenerated,
              total_complete: completedNow,
              total_scenes: totalScenes,
              next_pending_page: scene.page_number,
            }
          )

          // Release the worker claim so the next invocation can take it.
          // Conditional on our own worker_id: if we were already reclaimed
          // (lease expired under us) we must not null out someone else's lock.
          await supabase
            .from('story_requests')
            .update({
              worker_id: null,
              worker_lease_expires_at: null,
              status: 'generating_images',
              status_message: `Illustrating… (${completedNow} of ${totalScenes} done)`,
              progress_pct: Math.round(45 + (completedNow / totalScenes) * 30),
            })
            .eq('id', requestId)
            .eq('worker_id', workerId)

          await log('continuation_scheduled', `Worker released — next run resumes from page ${scene.page_number}`)

          // Backend-owned continuation: invoke ourselves for the next batch.
          // The browser is never part of this; the scheduled sweep catches
          // the rare case where this dispatch is lost.
          const dispatch = await dispatchSelf({ requestId, language, mode: 'continue' })
          await log(
            'continuation_dispatched',
            dispatch.ok
              ? `Continuation invocation dispatched${dispatch.status ? ` (HTTP ${dispatch.status})` : ''}`
              : `Continuation dispatch failed — sweep will retry: ${dispatch.error ?? `HTTP ${dispatch.status}`}`,
            dispatch.ok ? 'info' : 'warning',
            { dispatch },
          )

          return new Response(
            JSON.stringify({ requestId, status: 'continuation', imagesGenerated, completedNow, totalScenes }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // ── Generate + upload one image ───────────────────────────────────
        // Prompt = book anchors + characters present + page continuity +
        // the page's image_description + art direction + safety.
        const built = buildImagePrompt({
          bible: visualBible,
          pageNumber: scene.page_number,
          imageDescription: scene.image_prompt,
          planPage: findPlanPage(planForImages, scene.page_number),
          bandImageHint: imageCfg.bandImageHint,
          safetySuffix: imageCfg.safetySuffix,
        })
        try {
          const imageStarted = Date.now()
          const image = await generateImage(built.prompt)
          longestImageMs = Math.max(longestImageMs ?? 0, Date.now() - imageStarted)

          const storagePath = `${requestId}/${scene.page_number}.png`
          const { error: uploadError } = await supabase.storage
            .from('story-images')
            .upload(storagePath, image.bytes, { contentType: 'image/png', upsert: true })

          if (uploadError) {
            throw new Error(`Storage upload failed for page ${scene.page_number}: ${uploadError.message}`)
          }

          await supabase
            .from('story_scenes')
            .update({
              storage_path: storagePath,
              image_status: 'complete',
              image_model: image.model,
              image_revised_prompt: image.revisedPrompt,
              generation_attempts: Number(scene.generation_attempts ?? 0) + 1,
            })
            .eq('id', scene.id)

          imagesGenerated++

          const completedNow = completedBefore + imagesGenerated
          const progress = Math.round(45 + (completedNow / totalScenes) * 30)
          await setStatus('generating_images', `Illustrating page ${scene.page_number} of ${totalScenes}…`, progress)

          await log('generate_images', `Page ${scene.page_number} illustrated`, 'info', {
            page_number: scene.page_number,
            storage_path: storagePath,
            ...built.meta,
            revised_prompt_captured: image.revisedPrompt !== null,
          })
        } catch (imgErr) {
          imagesFailed++
          const imgMsg = imgErr instanceof Error ? imgErr.message : String(imgErr)
          console.error(`[process-story] Image failed page ${scene.page_number}:`, imgMsg)
          await supabase.from('story_scenes')
            .update({ image_status: 'failed', last_error: imgMsg.slice(0, 500), generation_attempts: Number(scene.generation_attempts ?? 0) + 1 })
            .eq('id', scene.id)
          await log('generate_images', `Page ${scene.page_number} image failed: ${imgMsg}`, 'warning', {
            page_number: scene.page_number,
            prompt_length: built.meta.prompt_length,
            character_anchor_count: built.meta.character_anchor_count,
          })
        }
      }

      await log(
        'all_images_complete',
        `Image pass complete — ${completedBefore + imagesGenerated}/${totalScenes} illustrated (${imagesGenerated} new this run, ${imagesFailed} failed)`,
        'info',
        {
          images_generated_this_run: imagesGenerated,
          images_failed: imagesFailed,
          total_complete: completedBefore + imagesGenerated,
          total_scenes: totalScenes,
        }
      )

      // ── Cover (Phase 1F): after the page pass, before completion ────────
      // One more DALL-E call, so it respects the same time budget and
      // continuation path as the page loop; a resumed run with every page
      // already drawn lands here directly. Failure is non-fatal (see
      // runCoverStage) and never blocks completion.
      const elapsedBeforeCover = Date.now() - workerStart
      const coverGuard = coverStartAllowed(elapsedBeforeCover, longestImageMs)
      if (!coverGuard.allowed) {
        await log('time_budget_reached', `Cover not started at ${Math.round(elapsedBeforeCover / 1000)}s (${coverGuard.reason}, projected ${Math.round(coverGuard.projected_ms / 1000)}s) — handing the cover to a fresh invocation`, 'info', { elapsed_ms: elapsedBeforeCover, stage: 'cover', reason: coverGuard.reason, projected_ms: coverGuard.projected_ms, longest_image_ms: longestImageMs })
        await supabase
          .from('story_requests')
          .update({
            worker_id: null,
            worker_lease_expires_at: null,
            status: 'generating_images',
            status_message: 'Illustrating the cover…',
            progress_pct: 78,
          })
          .eq('id', requestId)
          .eq('worker_id', workerId)
        await log('continuation_scheduled', 'Worker released — next run draws the cover and completes')
        const dispatch = await dispatchSelf({ requestId, language, mode: 'continue' })
        await log(
          'continuation_dispatched',
          dispatch.ok
            ? `Continuation invocation dispatched${dispatch.status ? ` (HTTP ${dispatch.status})` : ''}`
            : `Continuation dispatch failed — sweep will retry: ${dispatch.error ?? `HTTP ${dispatch.status}`}`,
          dispatch.ok ? 'info' : 'warning',
          { dispatch },
        )
        return new Response(
          JSON.stringify({ requestId, status: 'continuation', stage: 'cover_pending' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      await heartbeat()
      await setStatus('generating_images', 'Illustrating the cover…', 80)
      await runCoverStage({
        supabase,
        requestId,
        row: storyRequest,
        bible: visualBible,
        plan: planSource,
        config: configMap,
        skip: false,
        source: 'pipeline',
        ownsLease: stillOwnsLease,
        log,
      })
    }

    // ── Complete (exactly once) ───────────────────────────────────────────
    // Conditional on still holding the lease and on the row not already
    // being complete. If another worker finished first (or reclaimed us),
    // this UPDATE matches nothing and we skip every completion side effect.
    const { data: completedRow } = await supabase
      .from('story_requests')
      .update({
        status: 'complete',
        status_message: 'Your story is ready!',
        progress_pct: 100,
        completed_at: new Date().toISOString(),
        worker_id: null,
        worker_lease_expires_at: null,
      })
      .eq('id', requestId)
      .eq('worker_id', workerId)
      .neq('status', 'complete')
      .select('id')
      .maybeSingle()

    if (!completedRow) {
      await log('completion_skipped', 'Completion already recorded by another worker (or lease lost) — no side effects re-run', 'warning')
      return new Response(
        JSON.stringify({ requestId, status: 'complete', title: story.title, duplicate: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Increment the user's books_generated counter so plan limits are enforced.
    // Uses the same atomic usage_counted flip as status/route.ts so whichever path
    // fires first wins — the other silently no-ops, preventing double-counting.
    if (storyRequest.user_id && !storyRequest.usage_counted) {
      const { data: counted } = await supabase
        .from('story_requests')
        .update({ usage_counted: true })
        .eq('id', requestId)
        .eq('usage_counted', false)
        .select('id')
        .maybeSingle()
      if (counted) {
        await supabase.rpc('increment_books_generated', { user_id_input: storyRequest.user_id })
      }
    }

    // Completion email via the Next.js internal route (uses sendBookReadyEmail).
    // The route claims a one-shot idempotency key before sending, so this
    // call and any status-poll fallback can never both send. Awaited with
    // one retry so a transient failure is logged rather than lost; email
    // errors never fail the pipeline.
    if (storyRequest.user_email) {
      const notifyUrl = `${APP_URL}/api/internal/story-completed`
      let notified = false
      let lastErr = ''
      for (let attempt = 1; attempt <= 2 && !notified; attempt++) {
        try {
          const res = await fetch(notifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${EXPECTED_TOKEN}`,
            },
            body: JSON.stringify({ requestId }),
          })
          if (res.ok) { notified = true; break }
          lastErr = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err)
        }
        if (!notified && attempt === 1) await sleep(1500)
      }
      if (!notified) {
        await log('story_completed_notify_failed', `Ready-email callback failed after 2 attempts: ${lastErr}`, 'warning')
      }
    }

    await log('story_completed', `Story complete — ${imagesGenerated} new images this run, ${imagesFailed} failed`)

    return new Response(
      JSON.stringify({ requestId, status: 'complete', title: story.title }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {

    const message = err instanceof Error ? err.message : String(err)
    console.error(`[process-story] requestId=${requestId} error:`, message)

    const classified = classifyFailure(err, currentStage)
    // Only the worker that still owns the lease may fail the row. A stale
    // worker whose lease was reclaimed must not overwrite the live worker's
    // state or trigger a second failure email.
    const { data: failedRow } = await supabase
      .from('story_requests')
      .update({
        status: 'failed',
        worker_id: null,
        worker_lease_expires_at: null,
        last_error: message,
        failure_code: classified.code,
        failure_stage: classified.stage,
        retryable: classified.retryable,
        status_message: 'Something went wrong — we\'ll look into it.',
      })
      .eq('id', requestId)
      .eq('worker_id', workerId)
      .select('id')
      .maybeSingle()

    await log('pipeline_error', message, 'error', { code: classified.code, stage: classified.stage, retryable: classified.retryable, owned_lease: !!failedRow })

    if (!failedRow) {
      return new Response(
        JSON.stringify({ requestId, status: 'failed', error: message, staleWorker: true }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Notify the user their story failed — only on first failure (retry_count === 0).
    // Retries re-increment retry_count before re-queuing, so this guard prevents
    // sending a second error email if the user hits retry and it fails again.
    if (storyRequest?.user_email && storyRequest?.child_name && storyRequest?.retry_count === 0) {
      try {
        const retryUrl = `${APP_URL}/story/${requestId}`
        const errorEmailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: storyRequest.user_email,
            subject: `We hit a snag with ${storyRequest.child_name}'s story`,
            html: `
              <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#F8F5EC;">
                <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0C2340;">Nest &amp; Quill</p>
                <div style="background:#fff;border-radius:16px;border:1px solid #ede9dc;padding:36px;">
                  <h1 style="margin:0 0 12px;font-size:22px;color:#0C2340;">Something went wrong with ${storyRequest.child_name}'s story</h1>
                  <p style="margin:0 0 16px;font-size:15px;color:#2E2E2E;line-height:1.7;">
                    We ran into a problem while generating ${storyRequest.child_name}'s storybook. We're sorry about the interruption.
                  </p>
                  <p style="margin:0 0 24px;font-size:15px;color:#2E2E2E;line-height:1.7;">
                    You can try again from the story page — it only takes a moment and there's no charge.
                  </p>
                  <a href="${retryUrl}" style="display:inline-block;background:#C99700;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px;">
                    Try again →
                  </a>
                  <p style="margin:24px 0 0;font-size:13px;color:#4a4a4a;line-height:1.6;">
                    If the problem keeps happening, reply to this email and we'll sort it out.
                  </p>
                </div>
              </div>`,
          }),
        })

        if (errorEmailRes.ok) {
          const errorEmailJson = await errorEmailRes.json()
          try {
            await supabase.from('delivery_logs').insert({
              request_id: requestId,
              channel: 'email',
              status: 'sent',
              email_type: 'story_failed',
              recipient_email: storyRequest.user_email,
              resend_message_id: errorEmailJson.id ?? null,
            })
          } catch (logErr) {
            const logMsg = logErr instanceof Error ? logErr.message : String(logErr)
            await log('deliver', `Failed to write delivery_log for error email: ${logMsg}`, 'warning')
          }
        }
      } catch (_emailErr) {
        // Non-fatal — don't mask the original error
      }
    }

    return new Response(
      JSON.stringify({ requestId, status: 'failed', error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

