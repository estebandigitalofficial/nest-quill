import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import type { WriterBook } from '@/types/writer'

export default async function WriterPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const adminSupabase = createAdminClient()
  let query = adminSupabase.from('writer_books').select('*, owner:owner_id(email)').order('updated_at', { ascending: false })

  if (!ctx.isSuperAdmin) {
    query = query.eq('owner_id', ctx.userId)
  }

  const { data: books } = await query

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300">← Admin</Link>
          <span className="text-gray-700">/</span>
          <span className="font-semibold text-white">Book Writer</span>
        </div>
        <Link
          href="/admin/writer/new"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New book
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {(!books || books.length === 0) ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-4xl">📚</p>
            <p className="text-gray-400">No books yet. Start writing.</p>
            <Link
              href="/admin/writer/new"
              className="inline-block mt-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Create your first book
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(books as (WriterBook & { owner?: { email: string } | null })[]).map((book) => (
              <Link
                key={book.id}
                href={`/admin/writer/${book.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-5 hover:border-gray-600 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-lg text-white leading-snug">{book.title}</h2>
                  <StatusPill status={book.status} />
                </div>
                {book.subtitle && <p className="text-sm text-gray-400 italic">{book.subtitle}</p>}
                <p className="text-xs text-gray-500 line-clamp-2">{book.premise}</p>
                <div className="flex gap-3 pt-1 text-xs text-gray-600">
                  <span>{book.genre}</span>
                  <span>·</span>
                  <span>{book.target_chapters} chapters</span>
                  <span>·</span>
                  <span>~{(book.target_chapters * book.target_words_per_chapter).toLocaleString()} words</span>
                  {ctx.isSuperAdmin && book.owner?.email && (
                    <>
                      <span>·</span>
                      <span className="text-gray-700">{book.owner.email.split('@')[0]}</span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-800 text-gray-400',
    in_progress: 'bg-brand-900 text-brand-400',
    complete: 'bg-green-900 text-green-400',
    archived: 'bg-gray-800 text-gray-600',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${styles[status] ?? 'bg-gray-800 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
