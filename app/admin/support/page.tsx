import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { formatAZTimeShort } from '@/lib/utils/formatTime'
import type { SupportTicketRow } from '@/types/database'

const STATUS_BADGE: Record<SupportTicketRow['status'], string> = {
  open:             'bg-amber-900 text-amber-300',
  in_progress:      'bg-brand-900 text-brand-400',
  waiting_on_user:  'bg-violet-900 text-violet-300',
  resolved:         'bg-green-900 text-green-400',
  closed:           'bg-adm-surface text-adm-muted',
}

const PRIORITY_BADGE: Record<SupportTicketRow['priority'], string> = {
  low:     'text-adm-subtle',
  normal:  'text-adm-muted',
  high:    'text-amber-300',
  urgent:  'text-red-400',
}

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const { status: statusRaw } = await searchParams
  const status = (STATUS_FILTERS as readonly string[]).includes(statusRaw ?? '')
    ? (statusRaw as StatusFilter)
    : 'all'

  const db = createAdminClient()

  let listQuery = db
    .from('support_tickets')
    .select('id, email, name, subject, message, category, priority, status, created_at, updated_at, user_id, assigned_to')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status !== 'all') listQuery = listQuery.eq('status', status)
  const { data: tickets } = await listQuery

  const [{ count: openCount }, { count: urgentCount }] = await Promise.all([
    db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').not('status', 'in', '(resolved,closed)'),
  ])

  const rows = (tickets ?? []) as unknown as SupportTicketRow[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-adm-text">Support</h1>
        <p className="text-sm text-adm-muted mt-1">Tickets submitted via /contact and any future support widgets.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Open"   value={openCount ?? 0}   color="amber" />
        <Stat label="Urgent" value={urgentCount ?? 0} color={urgentCount ? 'red' : undefined} />
        <Stat label="Total"  value={rows.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(s => {
          const active = s === status
          const href = s === 'all' ? '/admin/support' : `/admin/support?status=${s}`
          return (
            <Link
              key={s}
              href={href}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active ? 'bg-brand-500 border-brand-500 text-adm-text' : 'bg-adm-surface border-adm-border text-adm-muted hover:text-adm-text hover:border-brand-600'
              }`}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </Link>
          )
        })}
      </div>

      <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-border">
              {rows.map(t => (
                <tr key={t.id} className="hover:bg-adm-surface/50 transition-colors">
                  <td className="px-4 py-3 text-adm-text max-w-[260px] truncate">
                    <span className="font-mono text-[10px] text-adm-subtle mr-2">#{t.id.slice(0, 8)}</span>
                    {t.subject}
                  </td>
                  <td className="px-4 py-3 text-adm-muted text-xs hidden md:table-cell">{t.email}</td>
                  <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell">{t.category ?? '—'}</td>
                  <td className={`px-4 py-3 text-xs font-semibold ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status]}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-adm-muted text-xs hidden lg:table-cell whitespace-nowrap">
                    {formatAZTimeShort(t.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/support/${t.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-adm-subtle">
                    {status === 'all' ? 'No tickets yet.' : `No tickets in "${status.replace(/_/g, ' ')}".`}
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

function Stat({ label, value, color }: { label: string; value: number; color?: 'amber' | 'red' }) {
  const valueColor = color === 'amber' ? 'text-amber-400' : color === 'red' ? 'text-red-400' : 'text-adm-text'
  return (
    <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-4">
      <p className="text-xs text-adm-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
