import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string; sceneId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId, chapterId, sceneId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  let mode: 'preserve_voice' | 'rewrite_free' = 'rewrite_free'
  let chapterNotes = ''
  try {
    const body = await req.json()
    if (body?.mode === 'preserve_voice') mode = 'preserve_voice'
    if (body?.chapterNotes) chapterNotes = body.chapterNotes
  } catch { /* no body — use default */ }

  const supabase = createAdminClient()

  const { data: book } = await supabase
    .from('writer_books')
    .select('*, source_text')
    .eq('id', bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const { data: chapters } = await supabase
    .from('writer_chapters')
    .select('*, writer_scenes(*)')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true })

  const { data: scene } = await supabase
    .from('writer_scenes')
    .select('*')
    .eq('id', sceneId)
    .single()

  if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 })

  const currentChapter = chapters?.find(c => c.id === chapterId)
  if (!currentChapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

  const outline = (chapters ?? []).map((ch: Record<string, unknown>) =>
    `Chapter ${ch.chapter_number}: ${ch.title} — ${ch.brief}`
  ).join('\n')

  const previousSummaries = (chapters ?? [])
    .filter((ch: Record<string, unknown>) => (ch.chapter_number as number) < currentChapter.chapter_number && ch.summary)
    .map((ch: Record<string, unknown>) => `Chapter ${ch.chapter_number} summary: ${ch.summary}`)
    .join('\n')

  const previousScenes = ((currentChapter.writer_scenes as unknown[]) ?? [])
    .filter((s: unknown) => (s as { scene_number: number }).scene_number < scene.scene_number && (s as { content: string | null }).content)
    .sort((a: unknown, b: unknown) => (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number)
    .map((s: unknown) => (s as { content: string }).content)
    .join('\n\n')

  const targetWords = Math.round(book.target_words_per_chapter / Math.max(1,
    ((currentChapter.writer_scenes as unknown[]) ?? []).length || 1
  ))

  const antiFabrication = `STRICT RULE: Only include people, places, events, and details that are present in the source manuscript. Do not invent characters, add people who were not there, fabricate conversations, or create dramatic details that did not happen. If the source does not mention it, do not add it.`

  const instructionsBlock = book.instructions
    ? `\nAUTHOR'S INSTRUCTIONS (follow these exactly — they override default style guidance):\n${book.instructions}\n`
    : ''

  // If a source manuscript exists, find the most relevant excerpt (~15k chars around chapter mention)
  let sourceExcerpt = ''
  if (book.source_text) {
    const src = book.source_text as string
    const chapterMarker = `chapter ${currentChapter.chapter_number}`
    const idx = src.toLowerCase().indexOf(chapterMarker)
    const start = idx > -1 ? Math.max(0, idx - 200) : 0
    sourceExcerpt = src.slice(start, start + 15000).trim()
  }

  const sourceInstruction = sourceExcerpt
    ? mode === 'preserve_voice'
      ? `Original manuscript excerpt (rewrite this scene using the constraints above):\n${sourceExcerpt}\n`
      : `Original manuscript excerpt (use as reference — rewrite/improve freely):\n${sourceExcerpt}\n`
    : ''

  // System prompt: PDF-source + preserve_voice uses the constrained rewrite mode
  const systemPrompt = (mode === 'preserve_voice' && sourceExcerpt)
    ? `You are rewriting a scene from the author's original manuscript.

Rewrite this content while strictly preserving its original structure, length, and meaning.

CRITICAL CONSTRAINTS:

1. LENGTH CONTROL
- Match the original length as closely as possible
- Do NOT expand the content
- Do NOT add new ideas, examples, or explanations
- The rewritten version should be within ±10% of the original word count

2. STRUCTURE LOCK
- Preserve paragraph count and order
- Do NOT merge or split paragraphs
- Maintain the same progression of ideas

3. CONTENT FIDELITY
- Do NOT introduce new concepts
- Do NOT remove specific details or moments
- Do NOT generalize specific experiences
- Keep all grounded examples intact

4. STYLE ADJUSTMENT (MINOR ONLY)
- Lightly improve clarity and sentence flow
- Simplify wording where appropriate
- Keep tone restrained, direct, and observational
- Do NOT make the writing more emotional or descriptive

5. STRICTLY AVOID:
- metaphors or poetic language
- added reflection or interpretation
- expanding simple ideas into longer explanations
- summarizing or compressing meaning

6. WRITING STANDARD:
- If a sentence can be clearer, adjust it slightly
- If it is already clear, leave it unchanged
- Default to preserving original phrasing unless improvement is necessary

${instructionsBlock}${antiFabrication}`
    : mode === 'preserve_voice'
    ? `You are editing and rewriting a ${book.genre} book while strictly preserving the author's original voice.
Tone: ${book.tone}
CRITICAL: You must maintain the author's exact voice — their sentence rhythm, vocabulary level, narrative style, point of view, and personality. Do not substitute your own prose style. Improve clarity, flow, and structure, but every sentence should still sound like the original author wrote it.
Write in flowing prose. No scene headings, no labels, no meta-commentary. Just the story.
${instructionsBlock}${antiFabrication}`
    : `You are a professional author writing a ${book.genre} book.
Tone: ${book.tone}
Write in flowing prose. No scene headings, no labels, no meta-commentary. Just the story.
Maintain complete consistency with everything established in prior chapters and scenes.
${instructionsBlock}${antiFabrication}`

  const userPrompt = `Book: "${book.title}"
Premise: ${book.premise}

Full outline:
${outline}

${previousSummaries ? `Previous chapters (summaries):\n${previousSummaries}\n` : ''}
${chapterNotes ? `CORRECTION NOTES FOR THIS CHAPTER (follow these exactly):\n${chapterNotes}\n` : ''}
${previousScenes ? `Earlier in Chapter ${currentChapter.chapter_number} (${currentChapter.title}):\n${previousScenes}\n` : ''}
${sourceInstruction}
Now write the next scene in Chapter ${currentChapter.chapter_number}: ${currentChapter.title}
Scene brief: ${scene.brief}
Target length: approximately ${targetWords} words.

Write only the scene content. No headings.`

  // Pre-flight fabrication check (gpt-4o-mini, cheap) — catches invented details before spending on full generation
  if (sourceExcerpt) {
    const preCheckPrompt = `You are a fact-checker for a memoir. Your job is to catch fabricated details BEFORE a scene is written.

Source manuscript excerpt (what actually happened):
${sourceExcerpt.slice(0, 4000)}

Scene brief: ${scene.brief}
${chapterNotes ? `Author's correction notes: ${chapterNotes}` : ''}

Does the scene brief or correction notes ask the AI to include people, places, or events that are NOT mentioned in the source excerpt above?
Respond ONLY with valid JSON: {"safe": true} if everything is grounded, or {"safe": false, "issues": ["issue 1", "issue 2"]} if fabrication risks are found.`

    try {
      const preRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: preCheckPrompt }],
          temperature: 0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
      })
      if (preRes.ok) {
        const preJson = await preRes.json()
        const check = JSON.parse(preJson.choices[0].message.content)
        if (check.safe === false && Array.isArray(check.issues) && check.issues.length > 0) {
          return NextResponse.json(
            { error: 'Pre-flight check flagged fabrication risks', issues: check.issues },
            { status: 422 }
          )
        }
      }
    } catch { /* if pre-check fails, proceed with generation anyway */ }
  }

  await supabase
    .from('writer_scenes')
    .update({ status: 'generating' })
    .eq('id', sceneId)

  const t0 = Date.now()

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI error ${res.status}: ${err}`)
    }

    const json = await res.json()
    const content: string = json.choices[0].message.content.trim()
    const wordCount = content.split(/\s+/).length
    const generationTimeMs = Date.now() - t0

    if (scene.content) {
      const { data: versions } = await supabase
        .from('writer_scene_versions')
        .select('version')
        .eq('scene_id', sceneId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = ((versions?.[0]?.version ?? 0) as number) + 1
      await supabase.from('writer_scene_versions').insert({
        scene_id: sceneId,
        version: nextVersion,
        content: scene.content,
        word_count: scene.word_count,
      })
    }

    await supabase
      .from('writer_scenes')
      .update({
        content,
        word_count: wordCount,
        status: 'draft',
        model_used: 'gpt-4o',
        generation_time_ms: generationTimeMs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sceneId)

    await supabase
      .from('writer_chapters')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', chapterId)

    return NextResponse.json({ sceneId, wordCount, generationTimeMs })

  } catch (err) {
    await supabase
      .from('writer_scenes')
      .update({ status: 'pending' })
      .eq('id', sceneId)

    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
