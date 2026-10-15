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
  if (!adminCtx) return null

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
    <>
      <header className="border-b border-adm-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Both crumbs truncate; the book title gives way first. */}
          <Link href={`/admin/writer/${bookId}`} className="text-xs text-adm-muted hover:text-adm-muted shrink min-w-0 max-w-[45%] truncate">
            ← {(book as WriterBook).title}
          </Link>
          <span className="text-gray-700 shrink-0">/</span>
          <span className="font-semibold text-adm-text truncate min-w-0">
            Ch. {chapter.chapter_number}: {chapter.title}
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <ChapterEditor book={book as WriterBook} chapter={chapterData} />
      </div>
    </>
  )
}
