import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import type { WriterBook } from '@/types/writer'
import DeleteBookButton from '@/components/admin/writer/DeleteBookButton'

type AuthorColorScheme = { border: string; dot: string; text: string }

const AUTHOR_COLORS: AuthorColorScheme[] = [
  { border: 'border-l-brand-500',  dot: 'bg-brand-500',   text: 'text-brand-400'   }, // amber/orange
  { border: 'border-l-blue-500',   dot: 'bg-blue-500',    text: 'text-blue-400'    }, // blue
  { border: 'border-l-violet-500', dot: 'bg-violet-500',  text: 'text-violet-400'  }, // violet
  { border: 'border-l-teal-500',   dot: 'bg-teal-500',    text: 'text-teal-400'    }, // teal
  { border: 'border-l-rose-500',   dot: 'bg-rose-500',    text: 'text-rose-400'    }, // rose
  { border: 'border-l-green-500',  dot: 'bg-green-500',   text: 'text-green-400'   }, // green
]

// Pinned colors — change only by explicit request
const PINNED_COLORS: Record<string, AuthorColorScheme> = {
  'fe53384e-5f3c-4eea-8a5b-5839763fad1d': AUTHOR_COLORS[1], // Esteban — blue
  '965ed669-8a1e-46e9-8646-d6bbb3ff7937': AUTHOR_COLORS[0], // Andrew — amber
}

function authorColor(ownerId: string | null): AuthorColorScheme {
  if (!ownerId) return AUTHOR_COLORS[0]
  if (PINNED_COLORS[ownerId]) return PINNED_COLORS[ownerId]
  let hash = 0
  for (let i = 0; i < ownerId.length; i++) hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0
  return AUTHOR_COLORS[hash % AUTHOR_COLORS.length]
}

export default async function WriterPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const adminSupabase = createAdminClient()
  const { data: books } = await adminSupabase
    .from('writer_books')
    .select('*')
    .order('updated_at', { ascending: false })

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
            <p className="font-serif text-xl text-gray-300">No books yet</p>
            <p className="text-gray-400">No books yet. Start writing.</p>
            <Link
              href="/admin/writer/new"
              className="inline-block mt-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Create your first book
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
            {(books as WriterBook[]).map((book) => {
              const color = authorColor(book.owner_id)
              const displayAuthor = book.pen_name ?? book.author_name
              const isOwner = book.owner_id === ctx.userId
              return (
                <div
                  key={book.id}
                  className={`bg-gray-900 border-l-4 ${color.border} px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:gap-4 hover:bg-gray-850 transition-colors group relative`}
                >
                  <Link href={`/admin/writer/${book.id}`} className="absolute inset-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="font-serif text-base text-white truncate">{book.title}</h2>
                      <StatusPill status={book.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-600">
                      {displayAuthor && (
                        <>
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                            <span className={`font-medium ${color.text}`}>{displayAuthor}</span>
                          </span>
                          <span>·</span>
                        </>
                      )}
                      <span>{book.genre}</span>
                      <span>·</span>
                      <span>{book.target_chapters} ch.</span>
                      {book.subtitle && <><span>·</span><span className="italic text-gray-600 truncate">{book.subtitle}</span></>}
                    </div>
                  </div>
                  <div className="flex gap-2 relative z-10 shrink-0 mt-3 sm:mt-0">
                    <DeleteBookButton bookId={book.id} isOwner={isOwner} />
                    <Link
                      href={`/admin/writer/${book.id}/read`}
                      className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                    >
                      Read
                    </Link>
                    {isOwner ? (
                      <Link
                        href={`/admin/writer/${book.id}`}
                        className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                      >
                        Edit
                      </Link>
                    ) : (
                      <span
                        title="You can only edit your own books"
                        className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-gray-800 text-gray-700 cursor-not-allowed"
                      >
                        Edit
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
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
