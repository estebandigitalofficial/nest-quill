import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import AdminUserControls from '@/components/admin/AdminUserControls'
import AdminUserSearch from '@/components/admin/AdminUserSearch'
import type { Profile, PlanTier } from '@/types/database'
import { formatAZTimeShort } from '@/lib/utils/formatTime'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

const PLAN_BADGE: Record<PlanTier, string> = {
  free: 'bg-gray-800 text-gray-400',
  single: 'bg-blue-900 text-blue-300',
  story_pack: 'bg-violet-900 text-violet-300',
  story_pro: 'bg-brand-900 text-brand-400',
  educator: 'bg-teal-900 text-teal-300',
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { q } = await searchParams
  const adminSupabase = createAdminClient()

  // ── Counts ────────────────────────────────────────────────────────────────
  const { count: totalUsers } = await adminSupabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const { count: paidUsers } = await adminSupabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .neq('plan_tier', 'free')

  const { count: activeUsers } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })

  // ── Users list ────────────────────────────────────────────────────────────
  let query = adminSupabase
    .from('profiles')
    .select('id, email, plan_tier, books_generated, books_limit, created_at, is_admin')
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) query = query.ilike('email', `%${q}%`)

  const { data: users } = await query
  const rows = (users ?? []) as unknown as (Profile & { is_admin: boolean })[]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-serif text-lg font-semibold text-white">
            Nest &amp; Quill
          </Link>
          <span className="text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Stories
          </Link>
          <Link href="/admin/users" className="text-xs font-semibold text-white">
            Users
          </Link>
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Writer →
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total users" value={totalUsers ?? 0} />
          <StatCard label="Paid users" value={paidUsers ?? 0} color="green" />
          <StatCard label="Created a story" value={activeUsers ?? 0} color="amber" />
        </div>

        {/* Search + table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Users
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
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Signed up</th>
                      <th className="text-left px-4 py-3">Plan &amp; quota</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rows.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{user.email}</span>
                            {user.is_admin && (
                              <span className="text-[10px] bg-brand-900 text-brand-400 font-semibold px-1.5 py-0.5 rounded-full">admin</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-600 font-mono mt-0.5">{user.id.slice(0, 8)}…</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatAZTimeShort(user.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[user.plan_tier] ?? 'bg-gray-800 text-gray-400'}`}>
                              {user.plan_tier.replace('_', ' ')}
                            </span>
                            <AdminUserControls
                              userId={user.id}
                              currentPlan={user.plan_tier}
                              booksGenerated={user.books_generated}
                              booksLimit={user.books_limit}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin?q=${encodeURIComponent(user.email)}`}
                            className="text-xs text-brand-400 hover:text-brand-300 font-medium whitespace-nowrap"
                          >
                            View stories →
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-600">
                          {q ? 'No users match that search.' : 'No users yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length === 100 && (
                <p className="text-xs text-gray-600 text-center py-3 border-t border-gray-800">
                  Showing first 100 — search by email to narrow down
                </p>
              )}
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
