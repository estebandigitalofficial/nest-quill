import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WriterBookWithChapters } from '@/types/writer'
import BookPageClient from '@/components/admin/writer/BookPageClient'

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/')

  const { bookId } = await params
  const adminSupabase = createAdminClient()

  const { data: book } = await adminSupabase
    .from('writer_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (!book) redirect('/admin/writer')

  const { data: chapters } = await adminSupabase
    .from('writer_chapters')
    .select('*, writer_scenes(*)')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true })

  const chaptersWithScenes = (chapters ?? []).map((ch: Record<string, unknown>) => ({
    ...ch,
    scenes: ((ch.writer_scenes as unknown[]) ?? []).sort(
      (a: unknown, b: unknown) => (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
    ),
  }))

  const bookData: WriterBookWithChapters = { ...book, chapters: chaptersWithScenes }

  type SceneRow = { content?: string | null; word_count?: number | null }
  const allScenes = chaptersWithScenes.flatMap(c => c.scenes as SceneRow[])
  const totalScenes = allScenes.length
  const doneScenes = allScenes.filter(s => s.content).length
  const totalWords = allScenes.reduce((sum, s) => sum + (s.word_count ?? 0), 0)
  const sourceWordCount = book.source_text ? (book.source_text as string).split(/\s+/).length : null

  return (
    <BookPageClient
      book={book}
      bookData={bookData}
      sourceWordCount={sourceWordCount}
      totalScenes={totalScenes}
      doneScenes={doneScenes}
      totalWords={totalWords}
    />
  )
}
