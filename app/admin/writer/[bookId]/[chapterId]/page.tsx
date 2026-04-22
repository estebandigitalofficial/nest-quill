import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import ChapterEditor from '@/components/admin/writer/ChapterEditor'
import type { WriterBook, WriterChapterWithScenes } from '@/types/writer'

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>
}) {
  const adminCtx = await getAdminContext()
  if (!adminCtx) redirect('/')

  const { bookId, chapterId } = await params
  const adminSupabase = createAdminClient()

  const { data: book } = await adminSupabase
    .from('writer_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (!book) redirect('/admin/writer')

  const { data: chapter } = await adminSupabase
    .from('writer_chapters')
    .select('*, writer_scenes(*)')
    .eq('id', chapterId)
    .single()

  if (!chapter) redirect(`/admin/writer/${bookId}`)

  const chapterData: WriterChapterWithScenes = {
    ...chapter,
    scenes: ((chapter.writer_scenes as unknown[]) ?? []).sort(
      (a: unknown, b: unknown) => (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
    ),
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/admin/writer/${bookId}`} className="text-xs text-gray-500 hover:text-gray-300 shrink-0">
            ← {(book as WriterBook).title}
          </Link>
          <span className="text-gray-700">/</span>
          <span className="font-semibold text-white truncate">
            Ch. {chapter.chapter_number}: {chapter.title}
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <ChapterEditor book={book as WriterBook} chapter={chapterData} />
      </div>
    </div>
  )
}
