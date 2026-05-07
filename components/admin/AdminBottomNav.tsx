'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Mobile-only bottom nav for the admin Command Center. Mirrors the
// desktop sidebar's grouping at a high level: home, ops, people,
// content, system. Pinned to the bottom as a frosted glass strip.

interface Section {
  label: string
  href: string
  activePaths: string[]
  exactRoot?: boolean
  accent: string
  icon: React.ReactNode
}

const SECTIONS: Section[] = [
  {
    label: 'Home',
    href: '/admin',
    activePaths: ['/admin', '/admin/library', '/admin/images'],
    exactRoot: true,
    accent: 'text-amber-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Ops',
    href: '/admin/beta-ops',
    activePaths: ['/admin/beta-ops', '/admin/tours'],
    accent: 'text-sky-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    label: 'Support',
    href: '/admin/support',
    activePaths: ['/admin/support'],
    accent: 'text-rose-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: 'Users',
    href: '/admin/users',
    activePaths: ['/admin/users', '/admin/guests', '/admin/classrooms'],
    accent: 'text-violet-300',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'System',
    href: '/admin/settings',
    activePaths: ['/admin/settings', '/admin/reporting', '/admin/beta'],
    accent: 'text-white',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function AdminBottomNav() {
  const pathname = usePathname()

  function isActive(section: Section) {
    if (section.exactRoot && pathname === '/admin') return true
    return section.activePaths
      .filter(p => p !== '/admin')
      .some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-adm-bg/85 backdrop-blur border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {SECTIONS.map(section => {
          const active = isActive(section)
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? section.accent : 'text-adm-muted'
              }`}
            >
              {section.icon}
              <span className="text-[10px] font-medium tracking-wide">
                {section.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
