import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  const supabase = createAdminClient()

  const { data: book } = await supabase
    .from('writer_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: chapters } = await supabase
    .from('writer_chapters')
    .select('*, writer_scenes(*)')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true })

  // Build Markdown
  const lines: string[] = []

  lines.push(`# ${book.title}`)
  if (book.subtitle) lines.push(`## ${book.subtitle}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const chapter of (chapters ?? [])) {
    lines.push(`# Chapter ${chapter.chapter_number}: ${chapter.title}`)
    lines.push('')

    const scenes = ((chapter.writer_scenes as unknown[]) ?? [])
      .filter((s: unknown) => (s as { content: string | null }).content)
      .sort((a: unknown, b: unknown) =>
        (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
      )

    for (const scene of scenes) {
      lines.push((scene as { content: string }).content)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  const markdown = lines.join('\n')
  const filename = `${book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
