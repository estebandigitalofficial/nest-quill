import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WriterBookWithChapters } from '@/types/writer'
import BookOutlineEditor from '@/components/admin/writer/BookOutlineEditor'
import BookSourcePanel from '@/components/admin/writer/BookSourcePanel'

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

  // Stats
  type SceneRow = { content?: string | null; word_count?: number | null }
  const allScenes = chaptersWithScenes.flatMap(c => c.scenes as SceneRow[])
  const totalScenes = allScenes.length
  const doneScenes = allScenes.filter(s => s.content).length
  const totalWords = allScenes.reduce((sum, s) => sum + (s.word_count ?? 0), 0)

  // Source manuscript word count (approximate)
  const sourceWordCount = book.source_text
    ? (book.source_text as string).split(/\s+/).length
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/writer" className="text-xs text-gray-500 hover:text-gray-300">← Books</Link>
          <span className="text-gray-700">/</span>
          <span className="font-semibold text-white truncate max-w-xs">{book.title}</span>
        </div>
        <a
          href={`/api/admin/writer/books/${bookId}/export`}
          className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          Export Markdown
        </a>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Book header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-5 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl text-white">{book.title}</h1>
              {book.subtitle && <p className="text-gray-400 italic text-sm mt-0.5">{book.subtitle}</p>}
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-xs text-gray-500">{book.genre} · {book.tone}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">{book.premise}</p>

          {/* Progress */}
          <div className="flex gap-6 pt-2 text-xs text-gray-500">
            <span><span className="text-white font-semibold">{book.target_chapters}</span> chapters planned</span>
            <span><span className="text-white font-semibold">{doneScenes}/{totalScenes}</span> scenes written</span>
            <span><span className="text-white font-semibold">{totalWords.toLocaleString()}</span> words so far</span>
          </div>
        </div>

        {/* Source manuscript */}
        <BookSourcePanel
          bookId={bookId}
          initialFileName={book.source_pdf_name ?? null}
          initialWordCount={sourceWordCount}
          needsMetadata={!!book.source_text && !book.premise}
        />

        {/* Outline editor */}
        <BookOutlineEditor book={bookData} />
      </div>
    </div>
  )
}
