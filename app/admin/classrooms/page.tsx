import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { formatAZTimeShort } from '@/lib/utils/formatTime'

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

type Filter = 'all' | 'active' | 'archived'

export default async function AdminClassroomsPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const { filter: raw } = await searchParams
  const filter: Filter = raw === 'all' ? 'all' : raw === 'archived' ? 'archived' : 'active'

  const admin = createAdminClient()

  const [
    { data: rawClassrooms },
    { data: allMembers },
    { data: allAssignments },
  ] = await Promise.all([
    admin
      .from('classrooms')
      .select('id, name, grade, subject, join_code, is_active, created_at, educator_id')
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('classroom_members').select('classroom_id').limit(50000),
    admin.from('assignments').select('classroom_id').limit(50000),
  ])

  const classrooms = (rawClassrooms ?? []) as {
    id: string; name: string; grade: number | null; subject: string | null
    join_code: string; is_active: boolean; created_at: string; educator_id: string
  }[]

  // Batch educator profiles
  const educatorIds = [...new Set(classrooms.map(c => c.educator_id))]
  const { data: educators } = educatorIds.length > 0
    ? await admin.from('profiles').select('id, email').in('id', educatorIds)
    : { data: [] as { id: string; email: string }[] }
  const educatorMap = new Map((educators ?? []).map((e: { id: string; email: string }) => [e.id, e]))

  // Count maps
  const memberCountMap = new Map<string, number>()
  for (const m of (allMembers ?? []) as { classroom_id: string }[]) {
    memberCountMap.set(m.classroom_id, (memberCountMap.get(m.classroom_id) ?? 0) + 1)
  }
  const assignCountMap = new Map<string, number>()
  for (const a of (allAssignments ?? []) as { classroom_id: string }[]) {
    assignCountMap.set(a.classroom_id, (assignCountMap.get(a.classroom_id) ?? 0) + 1)
  }

  const allRows = classrooms.map(c => ({
    ...c,
    educator: educatorMap.get(c.educator_id) ?? null,
    memberCount: memberCountMap.get(c.id) ?? 0,
    assignCount: assignCountMap.get(c.id) ?? 0,
  }))

  // Stats always from full dataset
  const totalActive   = allRows.filter(r =>  r.is_active).length
  const totalArchived = allRows.filter(r => !r.is_active).length

  // Displayed rows filtered by current selection
  const rows = filter === 'all'      ? allRows
             : filter === 'archived' ? allRows.filter(r => !r.is_active)
             :                         allRows.filter(r =>  r.is_active)

  const showStatusCol = filter !== 'active'
  const colSpan = showStatusCol ? 6 : 5

  const sectionLabel = filter === 'all' ? 'All classrooms'
                     : filter === 'archived' ? 'Archived classrooms'
                     : 'Active classrooms'

  const emptyMessage = filter === 'all' ? 'No classrooms yet.'
                     : filter === 'archived' ? 'No archived classrooms.'
                     : 'No active classrooms.'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── Stat cards (clickable filters) ──────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total classrooms" value={allRows.length}
          href="/admin/classrooms?filter=all" active={filter === 'all'}
        />
        <StatCard
          label="Active" value={totalActive} color="green"
          href="/admin/classrooms?filter=active" active={filter === 'active'}
        />
        <StatCard
          label="Archived" value={totalArchived}
          href="/admin/classrooms?filter=archived" active={filter === 'archived'}
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
          {sectionLabel}
        </h2>
        <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Classroom</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Educator</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Students</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Assignments</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Created</th>
                  {showStatusCol && <th className="text-left px-4 py-3">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-adm-border">
                {rows.map(r => (
                  <tr key={r.id} className="relative hover:bg-white/5 transition-colors cursor-pointer">

                    {/* First cell contains the row-wide click overlay */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/classrooms/${r.id}`}
                        className="after:absolute after:inset-0"
                      >
                        <p className="text-white font-medium text-sm">{r.name}</p>
                        <p className="text-[10px] text-adm-subtle mt-0.5">
                          {[r.grade ? `Grade ${r.grade}` : null, r.subject].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell relative z-10">
                      {r.educator?.email ?? <span className="text-adm-subtle italic">unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-adm-muted text-xs font-mono hidden md:table-cell relative z-10">
                      {r.memberCount}
                    </td>
                    <td className="px-4 py-3 text-adm-muted text-xs font-mono hidden md:table-cell relative z-10">
                      {r.assignCount}
                    </td>
                    <td className="px-4 py-3 text-adm-muted text-xs hidden lg:table-cell whitespace-nowrap relative z-10">
                      {formatAZTimeShort(r.created_at)}
                    </td>

                    {showStatusCol && (
                      <td className="px-4 py-3 relative z-10">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.is_active
                            ? 'bg-green-900 text-green-400'
                            : 'bg-adm-surface text-adm-subtle border border-adm-border'
                        }`}>
                          {r.is_active ? 'active' : 'archived'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-8 text-center text-adm-subtle">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {allRows.length === 500 && (
            <p className="text-xs text-adm-subtle text-center py-3 border-t border-adm-border">
              Showing first 500 classrooms
            </p>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Stat card (clickable filter) ──────────────────────────────────────────────

function StatCard({ label, value, href, active, color }: {
  label: string; value: number; href: string; active: boolean; color?: 'green' | 'amber'
}) {
  const valueColor = color === 'green' ? 'text-green-400' : color === 'amber' ? 'text-amber-400' : 'text-white'
  return (
    <Link
      href={href}
      className={`block bg-adm-surface rounded-2xl px-5 py-4 transition-colors hover:bg-white/5 ${
        active ? 'border-2 border-brand-500' : 'border-2 border-adm-border'
      }`}
    >
      <p className="text-xs text-adm-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </Link>
  )
}
