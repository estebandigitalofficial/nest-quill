import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { formatAZTimeShort } from '@/lib/utils/formatTime'
import type { SupportTicketRow } from '@/types/database'
import TicketEditor from './TicketEditor'

interface PageProps {
  params: Promise<{ ticketId: string }>
}

export default async function AdminSupportDetailPage({ params }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) return null
  const { ticketId } = await params

  const db = createAdminClient()
  const { data: ticket } = await db
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) notFound()

  const t = ticket as unknown as SupportTicketRow

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link href="/admin/support" className="text-xs text-adm-muted hover:text-white">← Back to support</Link>
        <h1 className="text-xl font-semibold text-white mt-1">
          <span className="font-mono text-sm text-adm-subtle mr-2">#{t.id.slice(0, 8)}</span>
          {t.subject}
        </h1>
        <p className="text-xs text-adm-muted mt-1">
          {t.email}{t.name ? ` · ${t.name}` : ''} · {t.category ?? 'no category'} · created {formatAZTimeShort(t.created_at)}
        </p>
      </div>

      <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-4">
        <p className="text-[11px] uppercase tracking-widest text-adm-muted mb-2">Message</p>
        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{t.message}</p>
      </div>

      <TicketEditor
        ticketId={t.id}
        initialStatus={t.status}
        initialPriority={t.priority}
        initialNotes={t.admin_notes ?? ''}
      />
    </div>
  )
}
