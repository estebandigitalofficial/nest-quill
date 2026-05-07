'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupportTicketStatus, SupportTicketPriority } from '@/types/database'

const STATUSES: SupportTicketStatus[] = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']
const PRIORITIES: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent']

export default function TicketEditor({
  ticketId,
  initialStatus,
  initialPriority,
  initialNotes,
}: {
  ticketId: string
  initialStatus: SupportTicketStatus
  initialPriority: SupportTicketPriority
  initialNotes: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [priority, setPriority] = useState(initialPriority)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, priority, admin_notes: notes }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `HTTP ${res.status}`)
      } else {
        router.refresh()
      }
    } catch {
      setError("Couldn't reach the server.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-adm-muted mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as SupportTicketStatus)}
            className="w-full bg-adm-bg border border-adm-border rounded-lg px-3 py-2 text-sm text-white">
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-adm-muted mb-1">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as SupportTicketPriority)}
            className="w-full bg-adm-bg border border-adm-border rounded-lg px-3 py-2 text-sm text-white">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-adm-muted mb-1">Admin notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="Internal notes — never shown to the user."
          className="w-full bg-adm-bg border border-adm-border rounded-lg px-3 py-2 text-sm text-white resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
