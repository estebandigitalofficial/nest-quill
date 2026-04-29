import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import AdminUserSearch from '@/components/admin/AdminUserSearch'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import { formatAZTimeShort } from '@/lib/utils/formatTime'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function AdminGuestsPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { q } = await searchParams
  const adminSupabase = createAdminClient()

  // ── Registered email set ──────────────────────────────────────────────────
  // Pull from profiles (primary, trigger-synced) AND auth.users (fallback for
  // any edge cases where a profile row might be missing).
  const [{ data: profileRows }, { data: authUsersData }] = await Promise.all([
    adminSupabase.from('profiles').select('email'),
    adminSupabase.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const registeredEmails = new Set<string>()
  for (const p of profileRows ?? []) {
    if (p.email) registeredEmails.add(p.email.toLowerCase())
  }
  for (const u of authUsersData?.users ?? []) {
    if (u.email) registeredEmails.add(u.email.toLowerCase())
  }

  // ── Guest submissions ─────────────────────────────────────────────────────
  let guestQuery = adminSupabase
    .from('story_requests')
    .select('user_email, status, created_at')
    .is('user_id', null)
    .not('user_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (q) guestQuery = guestQuery.ilike('user_email', `%${q}%`)

  const { data: guestRows } = await guestQuery

  // Partition: true guests vs rows whose email later registered (backfill candidates)
  let backfillCount = 0
  const guestMap = new Map<string, { total: number; completed: number; lastAt: string }>()

  for (const row of guestRows ?? []) {
    const email = (row.user_email as string).toLowerCase()

    if (registeredEmails.has(email)) {
      backfillCount++
      continue // exclude converted users from guest list
    }

    const existing = guestMap.get(email)
    if (existing) {
      existing.total++
      if (row.status === 'complete') existing.completed++
      if (row.created_at > existing.lastAt) existing.lastAt = row.created_at
    } else {
      guestMap.set(email, {
        total: 1,
        completed: row.status === 'complete' ? 1 : 0,
        lastAt: row.created_at as string,
      })
    }
  }

  const guests = Array.from(guestMap.entries())
    .map(([email, stats]) => ({ email, ...stats }))
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

  // Stats from true-guest rows only
  let totalSubmissions = 0
  let completedSubmissions = 0
  for (const g of guests) {
    totalSubmissions += g.total
    completedSubmissions += g.completed
  }

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
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Stories
          </Link>
          <Link href="/admin/library" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Library
          </Link>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Users
          </Link>
          <Link href="/admin/guests" className="text-xs font-semibold text-white">
            Guests
          </Link>
          <Link href="/admin/settings" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Settings
          </Link>
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Writer →
          </Link>
          <AdminLogoutButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Unique guests" value={guests.length} />
          <StatCard label="Total submissions" value={totalSubmissions} color="amber" />
          <StatCard label="Completed" value={completedSubmissions} color="green" />
        </div>

        {/* Backfill notice */}
        {backfillCount > 0 && !q && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-400">
            <span className="font-semibold text-gray-300">{backfillCount} submission{backfillCount !== 1 ? 's' : ''}</span>
            {' '}from emails that have since registered — excluded from this list.
            These <code className="text-gray-500">story_requests</code> rows still have{' '}
            <code className="text-gray-500">user_id IS NULL</code> and could be backfilled to the matching profile.
          </div>
        )}

        {/* Search + table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Guest submissions
          </h2>
          <div className="space-y-4">
            <Suspense>
              <AdminUserSearch defaultValue={q ?? ''} />
            </Suspense>

            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Last submission</th>
                      <th className="text-left px-4 py-3">Submissions</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {guests.map((g) => (
                      <tr key={g.email} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{g.email}</span>
                            <span className="text-[10px] bg-gray-800 text-gray-500 font-semibold px-1.5 py-0.5 rounded-full">guest</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatAZTimeShort(g.lastAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-300 font-mono">
                            {g.completed}/{g.total}
                          </span>
                          <span className="text-[10px] text-gray-600 ml-1">completed</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin?q=${encodeURIComponent(g.email)}`}
                            className="text-xs text-brand-400 hover:text-brand-300 font-medium whitespace-nowrap"
                          >
                            View stories →
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {guests.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-600">
                          {q ? 'No guest submissions match that search.' : 'No guest submissions yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: 'green' | 'amber' }) {
  const valueColor = color === 'green' ? 'text-green-400' : color === 'amber' ? 'text-amber-400' : 'text-white'
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
