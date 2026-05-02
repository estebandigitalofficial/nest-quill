'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  {
    label: 'Content',
    href: '/admin',
    activePaths: ['/admin', '/admin/library', '/admin/images'],
    exactRoot: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: 'People',
    href: '/admin/users',
    activePaths: ['/admin/users', '/admin/guests', '/admin/classrooms'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Writer',
    href: '/admin/writer',
    activePaths: ['/admin/writer', '/admin/writer-config'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    label: 'Outreach',
    href: '/admin/email-drips',
    activePaths: ['/admin/email-drips'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'System',
    href: '/admin/reporting',
    activePaths: ['/admin/reporting', '/admin/settings'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function AdminBottomNav() {
  const pathname = usePathname()

  function isActive(section: typeof SECTIONS[number]) {
    if (section.exactRoot && pathname === '/admin') return true
    return section.activePaths
      .filter(p => p !== '/admin')
      .some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-adm-bg border-t border-adm-border"
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
                active ? 'text-brand-400' : 'text-adm-muted'
              }`}
            >
              <span className={active ? 'text-brand-400' : 'text-adm-muted'}>
                {section.icon}
              </span>
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
