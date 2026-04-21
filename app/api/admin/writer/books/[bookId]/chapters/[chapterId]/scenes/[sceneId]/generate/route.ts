import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string; sceneId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId, chapterId, sceneId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const supabase = createAdminClient()

  const { data: book } = await supabase
    .from('writer_books')
    .select('*')
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

  const systemPrompt = `You are a professional author writing a ${book.genre} book.
Tone: ${book.tone}
Write in flowing prose. No scene headings, no labels, no meta-commentary. Just the story.
Maintain complete consistency with everything established in prior chapters and scenes.`

  const userPrompt = `Book: "${book.title}"
Premise: ${book.premise}

Full outline:
${outline}

${previousSummaries ? `Previous chapters (summaries):\n${previousSummaries}\n` : ''}
${previousScenes ? `Earlier in Chapter ${currentChapter.chapter_number} (${currentChapter.title}):\n${previousScenes}\n` : ''}
Now write the next scene in Chapter ${currentChapter.chapter_number}: ${currentChapter.title}
Scene brief: ${scene.brief}
Target length: approximately ${targetWords} words.

Write only the scene content. No headings.`

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
