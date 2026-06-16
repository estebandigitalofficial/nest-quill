import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { parseManuscript, countWords } from '@/lib/writer/parseManuscript'

export const maxDuration = 60

// Faithful transcription import: turn writer_books.source_text into real
// writer_chapters + one content-populated writer_scene each. No AI, no rewriting —
// the parser only slices the source text. source_text is never modified.
//
//   POST { commit: false }                -> preview (no writes)
//   POST { commit: true, mode: 'auto' }   -> create chapters from detected headings
//   POST { commit: true, mode: 'single' } -> single-chapter fallback (whole manuscript)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const body = await req.json().catch(() => ({}))
  const commit = body?.commit === true
  const mode: 'auto' | 'single' = body?.mode === 'single' ? 'single' : 'auto'

  const supabase = createAdminClient()
  const { data: book } = await supabase
    .from('writer_books')
    .select('title, source_text')
    .eq('id', bookId)
    .single()

  const sourceText = (book?.source_text as string | null) ?? ''
  if (!sourceText.trim()) {
    return NextResponse.json({ error: 'No source manuscript uploaded' }, { status: 400 })
  }

  const parsed = parseManuscript(sourceText)

  // ---- Preview (no writes) ----
  if (!commit) {
    return NextResponse.json({
      confidence: parsed.confidence,
      warnings: parsed.warnings,
      chapterCount: parsed.chapters.length,
      chapters: parsed.chapters.map(c => ({
        title: c.title,
        wordCount: countWords(c.content),
        excerpt: c.content.slice(0, 140),
      })),
      droppedPreambleChars: parsed.droppedPreamble.length,
    })
  }

  // ---- Commit ----
  const chaptersToCreate: { title: string; content: string }[] =
    mode === 'single'
      ? [{ title: book!.title as string, content: sourceText.trim() }]
      : parsed.chapters.map(c => ({ title: c.title, content: c.content }))

  if (chaptersToCreate.length === 0) {
    return NextResponse.json(
      { error: 'No chapters detected. Use single-chapter import instead.' },
      { status: 400 }
    )
  }

  // Replace any existing chapters (cascades to scenes). Caller confirms first.
  await supabase.from('writer_chapters').delete().eq('book_id', bookId)

  let totalScenes = 0
  for (let i = 0; i < chaptersToCreate.length; i++) {
    const ch = chaptersToCreate[i]

    const { data: chapter } = await supabase
      .from('writer_chapters')
      .insert({
        book_id: bookId,
        chapter_number: i + 1,
        title: ch.title,
        brief: 'Imported from manuscript',
        status: 'in_progress',
      })
      .select()
      .single()

    if (!chapter) continue

    await supabase.from('writer_scenes').insert({
      book_id: bookId,
      chapter_id: chapter.id,
      scene_number: 1,
      brief: 'Imported from manuscript',
      content: ch.content,
      word_count: countWords(ch.content),
      status: 'draft',
    })
    totalScenes++
  }

  await supabase
    .from('writer_books')
    .update({ target_chapters: chaptersToCreate.length, updated_at: new Date().toISOString() })
    .eq('id', bookId)

  return NextResponse.json({
    mode,
    chapterCount: chaptersToCreate.length,
    sceneCount: totalScenes,
  })
}
