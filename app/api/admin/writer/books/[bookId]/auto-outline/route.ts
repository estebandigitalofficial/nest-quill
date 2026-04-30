import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const supabase = createAdminClient()
  const { data: book } = await supabase
    .from('writer_books')
    .select('title, genre, tone, premise, instructions, target_chapters, target_words_per_chapter, source_text')
    .eq('id', bookId)
    .single()

  if (!book?.source_text) {
    return NextResponse.json({ error: 'No source manuscript uploaded' }, { status: 400 })
  }

  const sourceExcerpt = (book.source_text as string).slice(0, 60000)

  const instructionsBlock = book.instructions
    ? `\nAUTHOR'S INSTRUCTIONS (these override structural suggestions — the outline must respect the author's stated intent):\n${book.instructions}\n`
    : ''

  const systemPrompt = `You are a developmental editor creating a structural outline from a manuscript.

Your job is to produce an outline that:
1. Faithfully represents what is in the source manuscript — you are reorganizing and clarifying, not inventing
2. Gives each chapter a clear purpose and a specific identity so that an AI writer can later generate full prose without guessing
3. Makes every scene brief concrete enough to write from — not a theme, not a vague gesture, but a specific moment with specific people doing specific things
4. Creates a structure that serves the book's genre, tone, and premise

What you must NOT do:
- Invent major events, characters, or turning points that are not present in the source
- Use generic chapter titles ("A New Beginning", "The Journey", "Facing the Truth", "Moving Forward") — every title must be specific to what actually happens
- Write scene briefs that could apply to any book ("the characters have a tense conversation", "she reflects on her choices") — every brief must name the people, place, or specific moment
- Add motivational or structural scaffolding that the source does not support

Return valid JSON only. No markdown, no explanation, no text outside the JSON object.`

  const userPrompt = `Create a developmental chapter outline for this manuscript.

Book: "${book.title}"
Genre: ${book.genre}
Tone: ${book.tone}
Premise: ${book.premise}
Target: approximately ${book.target_chapters} chapters (adjust if the content warrants more or fewer — let the material decide)
${instructionsBlock}
Structural principles for this outline:
- The opening chapter must establish voice, stakes, and a reason to keep reading. It must not be throat-clearing.
- Every chapter must earn its place. If a chapter's only job is to move from A to B, combine it with the chapter before or after.
- Pacing: alternating weight between high-intensity and quieter chapters is usually stronger than constant escalation.
- The final chapter must pay off what was set up — no new major threads introduced at the end.
- For memoir/personal narrative: follow emotional logic, not just chronology. Rearrange chronology only if it serves clarity or impact.
- For nonfiction/self-help: each chapter should deliver one clear idea the reader did not have before opening it.
- For fiction: each chapter should change something — a relationship, a situation, a character's understanding.

Chapter title rules:
- Titles must be specific to what happens in that chapter, not thematic labels
- Good: "The morning Diane finds the letter", "Three months before the diagnosis", "What Marcus never told his father"
- Bad: "Revelations", "The Past Returns", "New Beginnings", "Turning Point"

Chapter brief rules (2-3 sentences per chapter):
- What specifically happens
- Why it belongs at this point in the book (what it sets up or pays off)
- What the reader understands or feels differently after this chapter

Chapter purpose rule (1 sentence):
- The structural job this chapter does — what would break if it were removed

Scene brief rules (1-2 sentences per scene):
- Must name the specific people, place, or moment — not generic action
- Must be actionable: a writer should be able to generate 300-600 words directly from this brief without inventing major details
- Good: "Carla confronts her sister in the hospital parking lot about the money — her sister deflects, then breaks down"
- Bad: "A confrontation reveals a family secret"

Return ONLY this JSON structure:
{
  "chapters": [
    {
      "title": "specific chapter title",
      "brief": "2-3 sentences: what happens, why here, what changes for the reader",
      "purpose": "1 sentence: the structural job this chapter does",
      "scenes": [
        { "brief": "specific, named, actionable scene brief" }
      ]
    }
  ]
}

Each chapter should have 3-5 scenes. Do not pad with weak scenes to hit a number — 3 strong scenes is better than 5 thin ones.

Manuscript:
${sourceExcerpt}`

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
      temperature: 0.4,
      max_tokens: 8192,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `AI error: ${err}` }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.choices[0].message.content.trim()

  let outline: { chapters: { title: string; brief: string; purpose: string; scenes: { brief: string }[] }[] }
  try {
    outline = JSON.parse(raw.replace(/^```json|^```|```$/gm, '').trim())
  } catch {
    return NextResponse.json({ error: 'Could not parse AI outline response' }, { status: 500 })
  }

  // Delete existing chapters (cascades to scenes)
  await supabase.from('writer_chapters').delete().eq('book_id', bookId)

  // Insert chapters and scenes — purpose saved to notes field (existing column)
  let totalScenes = 0
  for (let ci = 0; ci < outline.chapters.length; ci++) {
    const ch = outline.chapters[ci]

    const { data: chapter } = await supabase
      .from('writer_chapters')
      .insert({
        book_id: bookId,
        chapter_number: ci + 1,
        title: ch.title,
        brief: ch.brief,
        notes: ch.purpose ?? null,
      })
      .select()
      .single()

    if (!chapter) continue

    for (let si = 0; si < ch.scenes.length; si++) {
      await supabase.from('writer_scenes').insert({
        book_id: bookId,
        chapter_id: chapter.id,
        scene_number: si + 1,
        brief: ch.scenes[si].brief,
      })
      totalScenes++
    }
  }

  await supabase
    .from('writer_books')
    .update({ target_chapters: outline.chapters.length, updated_at: new Date().toISOString() })
    .eq('id', bookId)

  return NextResponse.json({
    chapterCount: outline.chapters.length,
    sceneCount: totalScenes,
  })
}
