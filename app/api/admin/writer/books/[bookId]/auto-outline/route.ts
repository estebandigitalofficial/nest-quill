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
    .select('title, genre, tone, premise, target_chapters, target_words_per_chapter, source_text')
    .eq('id', bookId)
    .single()

  if (!book?.source_text) {
    return NextResponse.json({ error: 'No source manuscript uploaded' }, { status: 400 })
  }

  // Use up to ~60k chars of source text for outlining
  const sourceExcerpt = (book.source_text as string).slice(0, 60000)

  const prompt = `You are a professional book editor and author. You have been given a manuscript and your job is to create an improved, restructured version of it.

Book: "${book.title}"
Genre: ${book.genre}
Tone: ${book.tone}

Analyze the manuscript and create a chapter-by-chapter outline for a rewritten, improved version. You may:
- Reorganize scenes for better pacing
- Split or combine chapters
- Add or remove scenes
- Strengthen dramatic structure (setup, rising action, climax, resolution per chapter)
- Improve scene sequencing

Return ONLY a JSON object in this exact format, no markdown, no explanation:
{
  "chapters": [
    {
      "title": "Chapter title",
      "brief": "2-3 sentence description of what happens and why it matters",
      "scenes": [
        { "brief": "1-2 sentence description of the key action/moment in this scene" }
      ]
    }
  ]
}

Guidelines:
- Aim for ${book.target_chapters} chapters (adjust if the content warrants more or fewer)
- Each chapter should have 3-5 scenes
- Scene briefs should be specific and actionable for an AI writer
- Focus on making the story better, not just copying the structure

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
        { role: 'system', content: 'You are a professional book editor. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `AI error: ${err}` }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.choices[0].message.content.trim()

  let outline: { chapters: { title: string; brief: string; scenes: { brief: string }[] }[] }
  try {
    outline = JSON.parse(raw.replace(/^```json|^```|```$/gm, '').trim())
  } catch {
    return NextResponse.json({ error: 'Could not parse AI outline response' }, { status: 500 })
  }

  // Delete existing chapters (cascades to scenes)
  await supabase.from('writer_chapters').delete().eq('book_id', bookId)

  // Insert chapters and scenes
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

  // Update book target_chapters to match what was created
  await supabase
    .from('writer_books')
    .update({ target_chapters: outline.chapters.length, updated_at: new Date().toISOString() })
    .eq('id', bookId)

  return NextResponse.json({
    chapterCount: outline.chapters.length,
    sceneCount: totalScenes,
  })
}
