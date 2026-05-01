import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatAZTimeShort } from '@/lib/utils/formatTime'
import LibraryFilters from './LibraryFilters'
import AdminRetryButton from '@/components/admin/AdminRetryButton'
import AdminForceRequeueButton from '@/components/admin/AdminForceRequeueButton'

const STUCK_THRESHOLD_MS = 10 * 60 * 1000

interface LibraryRow {
  id: string
  child_name: string
  user_email: string | null
  status: string
  created_at: string
  updated_at: string
  plan_tier: string
  genre: string | null
  illustration_style: string
  story_tone: string[] | null
  story_length: number
  generated_stories: { title: string }[] | null
  story_scenes: { id: string }[] | null
}

const STATUS_BADGE: Record<string, string> = {
  complete:           'bg-green-900/50 text-green-400 border border-green-800',
  failed:             'bg-red-900/50 text-red-400 border border-red-800',
  queued:             'bg-gray-800 text-gray-400 border border-gray-700',
  generating_text:    'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  generating_images:  'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  assembling_pdf:     'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
}

const STATUS_LABEL: Record<string, string> = {
  complete:           'Complete',
  failed:             'Failed',
  queued:             'Queued',
  generating_text:    'Processing',
  generating_images:  'Processing',
  assembling_pdf:     'Processing',
}

const PROCESSING_STATUSES = ['generating_text', 'generating_images', 'assembling_pdf']

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; genre?: string; style?: string }>
}

export default async function AdminLibraryPage({ searchParams }: PageProps) {
  const { q: rawQ, status: rawStatus, genre: genreFilter, style: styleFilter } = await searchParams
  const q = rawQ?.trim() ?? ''
  const status = rawStatus ?? 'all'

  const db = createAdminClient()

  let query = db
    .from('story_requests')
    .select(`
      id,
      child_name,
      user_email,
      status,
      created_at,
      updated_at,
      plan_tier,
      genre,
      illustration_style,
      story_tone,
      story_length,
      generated_stories ( title ),
      story_scenes ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    const safeQ = q.replace(/[,()"'\\]/g, '')
    const looksLikeId = /^[0-9a-f-]{8,}$/i.test(q)
    if (safeQ) {
      if (looksLikeId) {
        query = query.or(`child_name.ilike.%${safeQ}%,user_email.ilike.%${safeQ}%,id.eq.${q}`)
      } else {
        query = query.or(`child_name.ilike.%${safeQ}%,user_email.ilike.%${safeQ}%`)
      }
    }
  }

  if (status === 'processing') {
    query = query.in('status', PROCESSING_STATUSES)
  } else if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (genreFilter) query = query.eq('genre', genreFilter)
  if (styleFilter) query = query.eq('illustration_style', styleFilter)

  const { data, error } = await query
  if (error) console.error('[admin/library]', error)

  const rows = (data ?? []) as unknown as LibraryRow[]

  // Build filter options from data
  const genres = [...new Set(rows.map(r => r.genre).filter(Boolean))] as string[]
  const styles = [...new Set(rows.map(r => r.illustration_style).filter(Boolean))] as string[]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">Story Library</h1>
          <p className="text-sm text-gray-400 mt-1">
            {rows.length} {rows.length === 200 ? '(limit 200)' : ''} {q || status !== 'all' || genreFilter || styleFilter ? 'matching' : 'most recent'} stories
          </p>
        </div>
      </div>

      <Suspense>
        <LibraryFilters key={q} q={q} status={status} />
      </Suspense>

      {/* Genre/Style filter bar */}
      {(genres.length > 0 || styles.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {genres.length > 0 && (
            <FilterDropdown label="Genre" paramName="genre" options={genres} current={genreFilter} searchParams={{ q: rawQ, status: rawStatus, style: styleFilter }} />
          )}
          {styles.length > 0 && (
            <FilterDropdown label="Style" paramName="style" options={styles} current={styleFilter} searchParams={{ q: rawQ, status: rawStatus, genre: genreFilter }} />
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-widest">
                <th className="text-left px-5 py-3 font-semibold">Title</th>
                <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Genre</th>
                <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Style</th>
                <th className="text-left px-5 py-3 font-semibold hidden xl:table-cell">Tone</th>
                <th className="text-left px-5 py-3 font-semibold hidden xl:table-cell">Pages</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Date</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const title = row.generated_stories?.[0]?.title ?? `${row.child_name}'s Story`
                const email = row.user_email ?? '—'
                const badgeClass = STATUS_BADGE[row.status] ?? 'bg-gray-800 text-gray-400 border border-gray-700'
                const badgeLabel = STATUS_LABEL[row.status] ?? row.status
                const isProcessing = PROCESSING_STATUSES.includes(row.status)
                const isStuck = isProcessing && Date.now() - new Date(row.updated_at).getTime() > STUCK_THRESHOLD_MS
                const isFailed = row.status === 'failed'
                const imageCount = row.story_scenes?.length ?? 0

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-800/50 hover:bg-gray-900 transition-colors ${i === rows.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="max-w-[220px] sm:max-w-sm truncate">
                        <Link
                          href={`/story/${row.id}`}
                          target="_blank"
                          className="text-sm font-semibold text-white hover:text-brand-400 transition-colors"
                        >
                          {title}
                        </Link>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{row.child_name} · {row.plan_tier}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-gray-400 text-xs">{email}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{row.genre ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{row.illustration_style}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      <span className="text-xs text-gray-500">{row.story_tone?.join(', ') ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      <span className="text-xs text-gray-400 font-mono">{row.story_length}p / {imageCount}img</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{formatAZTimeShort(row.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2 sm:gap-3">
                        <Link href={`/story/${row.id}`} target="_blank" className="text-xs text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap">View ↗</Link>
                        <Link href={`/admin/stories/${row.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap">Detail</Link>
                        {isFailed && <AdminRetryButton requestId={row.id} />}
                        {isStuck && <AdminForceRequeueButton requestId={row.id} />}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-gray-600 text-sm">
                    {q || status !== 'all' ? 'No stories match your filters.' : 'No stories yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FilterDropdown({
  label,
  paramName,
  options,
  current,
  searchParams,
}: {
  label: string
  paramName: string
  options: string[]
  current?: string
  searchParams: Record<string, string | undefined>
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}:</span>
      <div className="flex gap-1 flex-wrap">
        {current && (
          <Link
            href={`/admin/library?${buildParams({ ...searchParams, [paramName]: undefined })}`}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            All
          </Link>
        )}
        {options.sort().map((opt) => (
          <Link
            key={opt}
            href={`/admin/library?${buildParams({ ...searchParams, [paramName]: opt })}`}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
              current === opt
                ? 'bg-brand-900 text-brand-400'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            {opt.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>
    </div>
  )
}

function buildParams(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v)
  }
  return p.toString()
}
