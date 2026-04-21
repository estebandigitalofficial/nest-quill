import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import EbookReader from '@/components/admin/writer/EbookReader'

export default async function ReadPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { bookId } = await params
  const supabase = createAdminClient()

  const [{ data: book }, { data: chapters }, { data: sections }] = await Promise.all([
    supabase.from('writer_books').select('*').eq('id', bookId).single(),
    supabase
      .from('writer_chapters')
      .select('*, writer_scenes(*)')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true }),
    supabase
      .from('writer_book_sections')
      .select('*')
      .eq('book_id', bookId)
      .order('position', { ascending: true }),
  ])

  if (!book) redirect('/admin/writer')

  const chaptersWithScenes = (chapters ?? []).map((ch: Record<string, unknown>) => ({
    id: ch.id as string,
    chapter_number: ch.chapter_number as number,
    title: ch.title as string,
    scenes: ((ch.writer_scenes as unknown[]) ?? [])
      .sort((a: unknown, b: unknown) =>
        (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
      )
      .map((s: unknown) => ({
        id: (s as { id: string }).id,
        scene_number: (s as { scene_number: number }).scene_number,
        content: (s as { content: string | null }).content,
      })),
  }))

  return (
    <EbookReader
      book={book}
      chapters={chaptersWithScenes}
      sections={sections ?? []}
    />
  )
}
