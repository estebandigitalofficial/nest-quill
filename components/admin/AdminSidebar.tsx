'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EXPANDED_HUB_HREF, navGroups, type AdminNavGroup } from '@/lib/admin/nav'

// Sidebar for the Command Center (Phase 2B information architecture):
// CURRENT groups are primary; EXPANDED groups sit below in a visibly
// secondary block with a link to the Expanded hub. Groups and items come
// from lib/admin/nav.ts so tests can pin the layout.

export default function AdminSidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const renderGroup = (group: AdminNavGroup, muted = false) => (
    <div key={group.label}>
      <div className="px-2 mb-1.5 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${group.accent} ${muted ? 'opacity-50' : ''}`} />
        <p className="text-[10px] font-medium text-adm-subtle uppercase tracking-[0.12em]">{group.label}</p>
      </div>
      <div className="space-y-0.5">
        {group.items.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.hint}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-adm-surface text-adm-text font-medium'
                  : muted
                    ? 'text-adm-subtle hover:text-adm-text hover:bg-adm-surface/60'
                    : 'text-adm-muted hover:text-adm-text hover:bg-adm-surface/60'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )

  return (
    <nav className="py-5 px-3 space-y-5" aria-label="Admin">
      <div className="px-2">
        <p className="text-[10px] font-bold text-brand-500 uppercase tracking-[0.18em]">Current</p>
        <p className="text-[10px] text-adm-subtle mt-0.5">Children&apos;s-book launch</p>
      </div>
      {navGroups('current').map(g => renderGroup(g))}

      <div className="pt-4 mt-2 border-t border-adm-border space-y-5">
        <div className="px-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-adm-subtle uppercase tracking-[0.18em]">Expanded</p>
            <p className="text-[10px] text-adm-subtle/80 mt-0.5">Preserved &amp; future systems</p>
          </div>
          <Link href={EXPANDED_HUB_HREF} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${pathname === EXPANDED_HUB_HREF ? 'border-adm-text/40 text-adm-text' : 'border-adm-border text-adm-subtle hover:text-adm-text'}`}>
            All
          </Link>
        </div>
        {navGroups('expanded').map(g => renderGroup(g, true))}
      </div>
    </nav>
  )
}
