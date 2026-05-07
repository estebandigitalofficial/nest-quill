// Consistent section heading for admin pages — small all-caps label
// (matches the existing convention) plus an optional sub-line and
// right-side action area.

import type { ReactNode } from 'react'

export default function AdminSectionHeader({
  label,
  sub,
  right,
}: {
  label: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest">{label}</p>
        {sub && <p className="text-[11px] text-adm-subtle mt-0.5">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
