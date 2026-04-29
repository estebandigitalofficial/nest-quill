import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { getAdminContext } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatAZTimeShort } from '@/lib/utils/formatTime'
import LibraryFilters from './LibraryFilters'
import AdminRetryButton from '@/components/admin/AdminRetryButton'
import AdminForceRequeueButton from '@/components/admin/AdminForceRequeueButton'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'

const STUCK_THRESHOLD_MS = 10 * 60 * 1000

interface LibraryRow {
  id: string
  child_name: string
  user_email: string | null
  status: string
  created_at: string
  updated_at: string
  plan_tier: string
  generated_stories: { title: string }[] | null
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
  searchParams: Promise<{ q?: string; status?: string }>
}

export default async function AdminLibraryPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { q: rawQ, status: rawStatus } = await searchParams
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
      generated_stories ( title )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  // Search: child_name, user_email, and exact request_id match.
  // Strip chars that break PostgREST .or() filter syntax (comma = condition separator).
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

  // Status filter
  if (status === 'processing') {
    query = query.in('status', PROCESSING_STATUSES)
  } else if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/library]', error)
  }

  const rows = (data ?? []) as unknown as LibraryRow[]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/admin" className="font-serif text-base sm:text-lg font-semibold text-white">
            Nest &amp; Quill
          </Link>
          <span className="hidden sm:inline-block text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Stories</Link>
          <Link href="/admin/library" className="text-xs font-semibold text-white">Library</Link>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Users</Link>
          <Link href="/admin/guests" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Guests</Link>
          <Link href="/admin/settings" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Settings</Link>
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">Writer →</Link>
          <AdminLogoutButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-white">Story Library</h1>
            <p className="text-sm text-gray-400 mt-1">
              {rows.length} {rows.length === 200 ? '(limit 200)' : ''} {q || status !== 'all' ? 'matching' : 'most recent'} stories
            </p>
          </div>
        </div>

        {/* Filters — key forces remount when q changes so defaultValue stays in sync */}
        <Suspense>
          <LibraryFilters key={q} q={q} status={status} />
        </Suspense>

        {/* Table */}
        <div className="rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-widest">
                <th className="text-left px-5 py-3 font-semibold">Title</th>
                <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">Email</th>
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

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-800/50 hover:bg-gray-900 transition-colors ${i === rows.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="max-w-[260px] sm:max-w-sm truncate">
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
                        <Link
                          href={`/story/${row.id}`}
                          target="_blank"
                          className="text-xs text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
                        >
                          View ↗
                        </Link>
                        <Link
                          href={`/admin/stories/${row.id}`}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap"
                        >
                          Detail
                        </Link>
                        {isFailed && <AdminRetryButton requestId={row.id} />}
                        {isStuck && <AdminForceRequeueButton requestId={row.id} />}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-600 text-sm">
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
