'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_BOTTOM_TABS, type AdminTab } from '@/lib/admin/nav'

// Mobile-only bottom nav for the admin Command Center (Phase 2B): the
// CURRENT essentials — Home, Stories, Users, Ops — plus an Expanded tab
// that opens the hub for preserved/future systems. Tabs come from
// lib/admin/nav.ts; only the icons live here.

const ICONS: Record<AdminTab['key'], React.ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
  ),
  stories: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
  ),
  ops: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
  ),
  expanded: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
  ),
}

const ACCENT: Record<AdminTab['key'], string> = { home: 'text-adm-text', stories: 'text-blue-400', users: 'text-rose-400', ops: 'text-sky-400', expanded: 'text-amber-300' }

export default function AdminBottomNav() {
  const pathname = usePathname()

  function isActive(tab: AdminTab) {
    if (tab.exactRoot && pathname === '/admin') return true
    return tab.activePaths.some(p => p !== '/admin' && (pathname === p || pathname.startsWith(p + '/')))
  }

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-adm-bg/90 backdrop-blur border-t border-adm-border" aria-label="Admin sections">
      <div className="flex items-stretch justify-around px-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {ADMIN_BOTTOM_TABS.map(tab => {
          const active = isActive(tab)
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 min-w-[56px] text-[10px] font-medium transition-colors ${
                active ? ACCENT[tab.key] : 'text-adm-muted'
              }`}
            >
              {ICONS[tab.key]}
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
