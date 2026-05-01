import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import AdminUserControls from '@/components/admin/AdminUserControls'
import AdminUserActions from '@/components/admin/AdminUserActions'
import AdminUserSearch from '@/components/admin/AdminUserSearch'
import UserDetailPanel from './UserDetailPanel'
import type { Profile, PlanTier } from '@/types/database'
import { formatAZTimeShort } from '@/lib/utils/formatTime'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

const PLAN_BADGE: Record<PlanTier, string> = {
  free: 'bg-adm-surface text-adm-muted',
  single: 'bg-blue-900 text-blue-300',
  story_pack: 'bg-violet-900 text-violet-300',
  story_pro: 'bg-brand-900 text-brand-400',
  educator: 'bg-teal-900 text-teal-300',
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) return null
  const currentUserId = ctx.userId

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
  // Fetch auth.users for real created_at — profiles.created_at is unreliable
  // because rows were backfilled at a single point in time.
  const { data: authUsersData } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  const authMeta = new Map(
    (authUsersData?.users ?? []).map(u => [u.id, { created_at: u.created_at, banned_until: u.banned_until ?? null }])
  )

  let query = adminSupabase
    .from('profiles')
    .select('id, email, plan_tier, books_generated, books_limit, is_admin')
    .limit(100)

  if (q) query = query.ilike('email', `%${q}%`)

  const { data: users } = await query

  // Batch query story counts
  const userIds = (users ?? []).map(u => u.id)
  const { data: storyCounts } = await adminSupabase
    .from('story_requests')
    .select('user_id')
    .in('user_id', userIds.length > 0 ? userIds : ['__none__'])
  const storyCountMap = new Map<string, number>()
  for (const row of storyCounts ?? []) {
    storyCountMap.set(row.user_id, (storyCountMap.get(row.user_id) ?? 0) + 1)
  }

  // Batch query last login from auth meta
  const authLastLogin = new Map(
    (authUsersData?.users ?? []).map(u => [u.id, u.last_sign_in_at ?? null])
  )

  const rows = (users ?? []).map(u => {
    const meta = authMeta.get(u.id)
    const bannedUntil = meta?.banned_until ?? null
    const isBanned = !!bannedUntil && new Date(bannedUntil) > new Date()
    return {
      ...(u as unknown as Profile & { is_admin: boolean }),
      created_at: meta?.created_at ?? new Date(0).toISOString(),
      isBanned,
      storyCount: storyCountMap.get(u.id) ?? 0,
      lastLogin: authLastLogin.get(u.id) ?? null,
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total users" value={totalUsers ?? 0} />
          <StatCard label="Paid users" value={paidUsers ?? 0} color="green" />
          <StatCard label="Story submissions" value={activeUsers ?? 0} color="amber" />
        </div>

        {/* Search + table */}
        <div>
          <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
            Registered users
          </h2>
          <div className="space-y-4">
            <Suspense>
              <AdminUserSearch defaultValue={q ?? ''} />
            </Suspense>

            <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Signed up</th>
                      <th className="text-left px-4 py-3 hidden lg:table-cell">Last login</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Stories</th>
                      <th className="text-left px-4 py-3">Plan &amp; quota</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-adm-border">
                    {rows.map((user) => (
                      <tr key={user.id} className="hover:bg-adm-surface/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium text-sm">{user.email}</span>
                            {user.is_admin && (
                              <span className="text-[10px] bg-brand-900 text-brand-400 font-semibold px-1.5 py-0.5 rounded-full">admin</span>
                            )}
                            {user.isBanned && (
                              <span className="text-[10px] bg-orange-950 text-orange-400 font-semibold px-1.5 py-0.5 rounded-full">banned</span>
                            )}
                          </div>
                          <p className="text-[10px] text-adm-subtle font-mono mt-0.5">{user.id.slice(0, 8)}…</p>
                        </td>
                        <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatAZTimeShort(user.created_at)}
                        </td>
                        <td className="px-4 py-3 text-adm-muted text-xs hidden lg:table-cell whitespace-nowrap">
                          {user.lastLogin ? formatAZTimeShort(user.lastLogin) : '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-adm-muted font-mono">{user.storyCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[user.plan_tier] ?? 'bg-adm-surface text-adm-muted'}`}>
                              {user.plan_tier.replace('_', ' ')}
                            </span>
                            <AdminUserControls
                              userId={user.id}
                              currentPlan={user.plan_tier}
                              booksGenerated={user.books_generated}
                              booksLimit={user.books_limit}
                            />
                            <AdminUserActions
                              userId={user.id}
                              isSelf={user.id === currentUserId}
                              userEmail={user.email}
                              isBanned={user.isBanned}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right space-y-1">
                          <Link
                            href={`/admin?q=${encodeURIComponent(user.email)}`}
                            className="text-xs text-brand-400 hover:text-brand-300 font-medium whitespace-nowrap"
                          >
                            View stories →
                          </Link>
                          <UserDetailPanel userId={user.id} />
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-adm-subtle">
                          {q ? 'No users match that search.' : 'No users yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length === 100 && (
                <p className="text-xs text-adm-subtle text-center py-3 border-t border-adm-border">
                  Showing first 100 — search by email to narrow down
                </p>
              )}
            </div>
          </div>
        </div>

    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: 'green' | 'amber' }) {
  const valueColor = color === 'green' ? 'text-green-400' : color === 'amber' ? 'text-amber-400' : 'text-white'
  return (
    <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-4">
      <p className="text-xs text-adm-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
