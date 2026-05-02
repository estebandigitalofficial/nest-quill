// @ts-nocheck — this file runs in Deno (Supabase Edge Function), not Node. TS server does not know Deno globals.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'stories@nestandquill.com'
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://nestandquill.com'
const EXPECTED_TOKEN = Deno.env.get('EDGE_FUNCTION_SECRET') ?? SUPABASE_SERVICE_ROLE_KEY
const SKIP_IMAGES = Deno.env.get('SKIP_IMAGE_GENERATION') === 'true'
const MOCK_PIPELINE = Deno.env.get('MOCK_PIPELINE') === 'true'

// Stop 40 seconds before the 150 s Edge Function hard limit.
// When the budget is reached the worker releases its claim (worker_id → null)
// and returns a 200 so the status-poller can re-trigger for the next batch.
const TIME_BUDGET_MS = 110_000

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

async function callOpenAI(messages: object[], model = 'gpt-4o'): Promise<string> {
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
      temperature: 0.8,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const json = await res.json()
  return json.choices[0].message.content
}

async function generateImage(prompt: string, illustrationStyle: string, config: ConfigMap = {}, childAge?: number): Promise<Uint8Array> {
  const styleHint = config['image_style_' + illustrationStyle]
    ?? FALLBACK_STYLE_HINTS[illustrationStyle]
    ?? FALLBACK_STYLE_HINTS.storybook
  const isAdult = childAge !== undefined && childAge >= 18
  const safetySuffix = isAdult
    ? (config['adult_image_safety_suffix'] ?? 'Artistic illustration, tasteful, no explicit content, no text or words in image.')
    : (config['image_safety_suffix'] ?? 'Child-safe, no text, no words in image.')
  const fullPrompt = `${styleHint}. ${prompt}. ${safetySuffix}`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: fullPrompt,
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
  const imageUrl = json.data[0].url

  // Download immediately — OpenAI signed URLs expire within ~1 hour
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to download image from OpenAI URL: ${imageRes.status}`)
  }

  const buffer = await imageRes.arrayBuffer()
  return new Uint8Array(buffer)
}

// ── Story prompt builder ──────────────────────────────────────────────────────

function buildStoryPrompt(request: Record<string, unknown>, config: ConfigMap = {}, language = 'en'): object[] {
  const {
    child_name,
    child_age,
    child_description,
    story_theme,
    story_tone,
    story_moral,
    story_length,
    illustration_style,
    dedication_text,
    supporting_characters,
    learning_mode,
    learning_subject,
    learning_grade,
    learning_topic,
  } = request

  const toneList = Array.isArray(story_tone) ? story_tone.join(', ') : story_tone
  const pageCount = Number(story_length) || 16
  const isLearning = learning_mode === true
  const isAdult = Number(child_age) >= 18

  // Helper to replace placeholders in config values
  function r(template: string): string {
    return template
      .replace(/\{child_age\}/g, String(child_age))
      .replace(/\{page_count\}/g, String(pageCount))
      .replace(/\{illustration_style\}/g, String(illustration_style))
      .replace(/\{tone_list\}/g, String(toneList))
      .replace(/\{learning_topic\}/g, String(learning_topic ?? ''))
      .replace(/\{learning_subject\}/g, String(learning_subject ?? ''))
      .replace(/\{learning_grade\}/g, String(learning_grade ?? ''))
  }

  const learningSystemNote = isLearning ? `\n\n${r(config['learning_mode_instructions'] ?? `LEARNING MODE ACTIVE:
This story must naturally weave in educational content about "{learning_topic}" ({learning_subject}, grade {learning_grade}).
- Introduce the concept early and reinforce it across multiple pages
- Use age-appropriate vocabulary for a grade {learning_grade} student
- Show the character applying or discovering the concept — don't just state facts
- The learning should feel like part of the story, not a lesson bolted on`)}` : ''

  const role = isAdult
    ? (config['adult_story_role'] ?? 'You are a professional fiction author. You write engaging, well-crafted stories for adult readers. Your writing is sophisticated, nuanced, and tailored to mature audiences.')
    : (config['story_role'] ?? "You are a professional children's book author. You write warm, age-appropriate stories for young children.")
  const outputFormat = config['story_output_format'] ?? `Your output must be valid JSON matching this exact structure:
{
  "title": "string — a short, memorable book title",
  "subtitle": "string — an optional subtitle (can be empty string)",
  "author_line": "A Nest & Quill Original",
  "dedication": "string — a short dedication (only if provided, otherwise empty string)",
  "synopsis": "string — 2-3 sentence description of the story",
  "pages": [
    {
      "page": 1,
      "text": "string — the story text for this page (2-4 sentences, age-appropriate)",
      "image_description": "string — a detailed visual description for an illustrator (what to draw on this page)"
    }
  ]
}`

  const rules = [
    r(config['story_page_rules'] ?? 'Write exactly {page_count} story pages'),
    r(isAdult
      ? (config['adult_story_language_rules'] ?? 'Write with sophisticated vocabulary appropriate for an adult reader. Use literary techniques, complex sentence structures, and nuanced character development.')
      : (config['story_language_rules'] ?? 'Keep language simple and age-appropriate for a {child_age}-year-old')),
    r(isAdult
      ? (config['adult_story_sentence_rules'] ?? 'Each page should have 3-6 sentences with rich descriptive prose')
      : (config['story_sentence_rules'] ?? 'Each page should have 2-4 sentences maximum')),
    r(config['story_image_desc_rules'] ?? 'Image descriptions should be vivid, specific, and describe a single scene'),
    r(config['story_illustration_style_rule'] ?? 'The illustration style is {illustration_style} — reflect this in image description language'),
    r(isAdult
      ? (config['adult_story_tone_rule'] ?? 'Tone: {tone_list}. Write with emotional depth and literary sophistication.')
      : (config['story_tone_rule'] ?? 'Tone: {tone_list}')),
    'Do not include page numbers or chapter headings in the text',
    r(isAdult
      ? (config['adult_story_ending_rule'] ?? 'End the story with a satisfying, thought-provoking conclusion that resonates emotionally')
      : (config['story_ending_rule'] ?? 'End the story with a satisfying, uplifting conclusion')),
  ]

  const spanishNote = language === 'es'
    ? '\n\nLANGUAGE REQUIREMENT: You MUST write the entire story — all page text, title, subtitle, synopsis, and dedication — in Spanish. All content must be in Spanish only.'
    : ''

  const systemPrompt = `${role}${learningSystemNote}${spanishNote}\n\n${outputFormat}\n\nRules:\n${rules.map(r => `- ${r}`).join('\n')}`

  const learningUserNote = isLearning
    ? `- Learning focus: ${learning_topic} (subject: ${learning_subject}, grade ${learning_grade})\n`
    : ''

  const userPrompt = `Write a ${isAdult ? 'story' : "children's storybook"} with these details:

- Main character: ${child_name}${isAdult ? '' : `, age ${child_age}`}
${child_description ? `- About ${child_name}: ${child_description}` : ''}
${supporting_characters ? `- Supporting characters to include: ${supporting_characters}` : ''}
- Story theme: ${story_theme}
- Tone: ${toneList}
${story_moral ? `- Moral or lesson to include: ${story_moral}` : ''}
${dedication_text ? `- Dedication: ${dedication_text}` : ''}
${learningUserNote}- Length: exactly ${pageCount} pages

Write the full story now.`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
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

  const raw = await callOpenAI(messages)
  const parsed = JSON.parse(raw)
  return parsed.questions
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  console.log('[process-story] invoked', req.method, new Date().toISOString())

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (token !== EXPECTED_TOKEN) {
    console.warn('[process-story] unauthorized — token mismatch')
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let requestId: string
  let language = 'en'
  try {
    const body = await req.json()
    requestId = body.requestId
    language = body.language === 'es' ? 'es' : 'en'
    if (!requestId) throw new Error('Missing requestId')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  console.log('[process-story] requestId=', requestId)

  // ── Supabase admin client ─────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Fetch the full story request ──────────────────────────────────────────
  const { data: storyRequest, error: fetchError } = await supabase
    .from('story_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !storyRequest) {
    return new Response('Story request not found', { status: 404 })
  }

  // ── Idempotency ───────────────────────────────────────────────────────────
  // Allow: queued, failed, and generating_images with no active worker (time-budget release).
  // Block: any status with an active worker_id that isn't in the retriable list.
  const retriable = ['queued', 'failed']
  if (storyRequest.worker_id !== null && !retriable.includes(storyRequest.status)) {
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

  // ── Claim this request ────────────────────────────────────────────────────
  const workerId = crypto.randomUUID()

  await supabase
    .from('story_requests')
    .update({
      worker_id: workerId,
      status: isResume ? 'generating_images' : 'generating_text',
      // Only stamp processing_started_at on the very first run
      ...(!isResume ? { processing_started_at: new Date().toISOString() } : {}),
      status_message: isResume ? 'Resuming illustrations…' : 'Writing your story…',
      progress_pct: isResume ? Math.max(storyRequest.progress_pct ?? 45, 45) : 10,
      last_error: null,
    })
    .eq('id', requestId)

  // Worker start time — used to enforce the time budget
  const workerStart = Date.now()

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
      // Fresh run — generate story text via GPT-4o.
      await log('generate_text', 'Calling OpenAI GPT-4o for story text')
      const t0 = Date.now()

      const messages = buildStoryPrompt(storyRequest, configMap, language)
      const rawContent = await callOpenAI(messages)
      const generatedStory = JSON.parse(rawContent)
      const generationTimeMs = Date.now() - t0

      if (!generatedStory.pages || !Array.isArray(generatedStory.pages) || generatedStory.pages.length === 0) {
        throw new Error('OpenAI returned invalid story structure — no pages found')
      }

      story = generatedStory

      await log('generate_text', `Story generated: "${story.title}" (${(story.pages as unknown[]).length} pages, ${generationTimeMs}ms)`, 'info', {
        title: story.title,
        page_count: (story.pages as unknown[]).length,
        generation_time_ms: generationTimeMs,
      })

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
          model_used: 'gpt-4o',
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

      const sceneRows = (story.pages as Record<string, unknown>[]).map((page) => ({
        story_id: savedStory.id,
        request_id: requestId,
        page_number: page.page,
        page_text: page.text,
        image_prompt: page.image_description,
        image_status: 'pending',
      }))

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

    // Read beta mode from app_settings at runtime (DB-driven, no redeploy needed)
    let betaMode = false
    try {
      const { data: betaRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'beta_mode_enabled')
        .single()
      betaMode = betaRow?.value === true
    } catch { /* fail open — proceed with real images */ }

    let imagesGenerated = 0
    let imagesFailed = 0

    if (SKIP_IMAGES || betaMode) {
      await log('generate_images', betaMode
        ? 'Image generation skipped (beta_mode_enabled=true)'
        : 'Image generation skipped (SKIP_IMAGE_GENERATION=true)'
      )
    } else {
      const { data: allScenes, error: sceneFetchError } = await supabase
        .from('story_scenes')
        .select('id, page_number, image_prompt, image_status, storage_path')
        .eq('request_id', requestId)
        .order('page_number', { ascending: true })

      if (sceneFetchError || !allScenes) {
        throw new Error(`Failed to fetch story scenes: ${sceneFetchError?.message}`)
      }

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

          // Release the worker claim so the status poller can re-trigger
          await supabase
            .from('story_requests')
            .update({
              worker_id: null,
              status: 'generating_images',
              status_message: `Illustrating… (${completedNow} of ${totalScenes} done)`,
              progress_pct: Math.round(45 + (completedNow / totalScenes) * 30),
            })
            .eq('id', requestId)

          await log('continuation_scheduled', `Worker released — next run resumes from page ${scene.page_number}`)

          return new Response(
            JSON.stringify({ requestId, status: 'continuation', imagesGenerated, completedNow, totalScenes }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // ── Generate + upload one image ───────────────────────────────────
        try {
          const imageBytes = await generateImage(
            scene.image_prompt,
            storyRequest.illustration_style,
            configMap,
            Number(storyRequest.child_age)
          )

          const storagePath = `${requestId}/${scene.page_number}.png`
          const { error: uploadError } = await supabase.storage
            .from('story-images')
            .upload(storagePath, imageBytes, { contentType: 'image/png', upsert: true })

          if (uploadError) {
            throw new Error(`Storage upload failed for page ${scene.page_number}: ${uploadError.message}`)
          }

          await supabase
            .from('story_scenes')
            .update({ storage_path: storagePath, image_status: 'complete' })
            .eq('id', scene.id)

          imagesGenerated++

          const completedNow = completedBefore + imagesGenerated
          const progress = Math.round(45 + (completedNow / totalScenes) * 30)
          await setStatus('generating_images', `Illustrating page ${scene.page_number} of ${totalScenes}…`, progress)

          await log('generate_images', `Page ${scene.page_number} illustrated`, 'info', {
            page_number: scene.page_number,
            storage_path: storagePath,
          })
        } catch (imgErr) {
          imagesFailed++
          const imgMsg = imgErr instanceof Error ? imgErr.message : String(imgErr)
          console.error(`[process-story] Image failed page ${scene.page_number}:`, imgMsg)
          await supabase.from('story_scenes').update({ image_status: 'failed' }).eq('id', scene.id)
          await log('generate_images', `Page ${scene.page_number} image failed: ${imgMsg}`, 'warning', {
            page_number: scene.page_number,
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
    }

    // ── Complete ──────────────────────────────────────────────────────────
    await supabase
      .from('story_requests')
      .update({
        status: 'complete',
        status_message: 'Your story is ready!',
        progress_pct: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

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

    // Fire completion email via the Next.js internal route (uses sendBookReadyEmail).
    // The route is idempotent — if the status poller already sent the email it no-ops.
    // Fire-and-forget: we don't await or fail the pipeline on email errors.
    if (storyRequest.user_email) {
      const notifyUrl = `${APP_URL}/api/internal/story-completed`
      fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EXPECTED_TOKEN}`,
        },
        body: JSON.stringify({ requestId }),
      }).catch((err) => console.error('[process-story] story-completed notify failed:', err))
    }

    await log('story_completed', `Story complete — ${imagesGenerated} new images this run, ${imagesFailed} failed`)

    return new Response(
      JSON.stringify({ requestId, status: 'complete', title: story.title }),
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

