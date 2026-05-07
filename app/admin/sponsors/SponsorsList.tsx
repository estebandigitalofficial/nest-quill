'use client'

import Link from 'next/link'
import { useState } from 'react'

interface SponsorRow {
  id: string
  name: string
  logo_url: string | null
  description: string | null
  contact_email: string | null
  total_budget_cents: number
  is_active: boolean
  created_at: string
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SponsorsList({ initialSponsors }: { initialSponsors: SponsorRow[] }) {
  const [sponsors] = useState(initialSponsors)

  if (sponsors.length === 0) {
    return (
      <div className="bg-adm-surface border border-dashed border-adm-border rounded-xl px-8 py-16 text-center space-y-2">
        <p className="font-semibold text-adm-text">No sponsors yet</p>
        <p className="text-sm text-adm-muted">Add your first brand partner to start funding rewards.</p>
        <Link
          href="/admin/sponsors/new"
          className="inline-block mt-2 bg-brand-500 hover:bg-brand-600 text-adm-text text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New sponsor
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-adm-bg/50 text-[11px] font-semibold text-adm-muted uppercase tracking-widest">
          <tr>
            <th className="text-left px-4 py-3">Sponsor</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Contact</th>
            <th className="text-right px-4 py-3">Budget</th>
            <th className="text-right px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-adm-border">
          {sponsors.map(s => (
            <tr key={s.id} className="hover:bg-adm-bg/40 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/admin/sponsors/${s.id}`} className="flex items-center gap-3 group">
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-adm-bg shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-adm-bg border border-adm-border flex items-center justify-center text-xs font-bold text-adm-muted shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-adm-text group-hover:text-brand-400 transition-colors truncate">{s.name}</p>
                    {s.description && <p className="text-[11px] text-adm-muted truncate max-w-[28ch]">{s.description}</p>}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-adm-muted hidden sm:table-cell">
                {s.contact_email ?? '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-adm-text">
                {formatCents(s.total_budget_cents)}
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                  s.is_active
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-adm-bg text-adm-muted border-adm-border'
                }`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
