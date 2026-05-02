'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { href: '/admin', label: 'Stories', exact: true },
      { href: '/admin/library', label: 'Library' },
      { href: '/admin/images', label: 'Images' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/guests', label: 'Guests' },
      { href: '/admin/classrooms', label: 'Classrooms' },
    ],
  },
  {
    label: 'Writer',
    items: [
      { href: '/admin/writer', label: 'Books' },
      { href: '/admin/writer-config', label: 'Config' },
      { href: '/admin/email-drips', label: 'Email Drips' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/reporting', label: 'Reporting' },
      { href: '/admin/settings', label: 'Settings' },
      { href: '/admin/beta', label: 'Beta Mode' },
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="py-5 px-3 space-y-5">
      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          <p className="px-2 mb-1 text-[10px] font-bold text-adm-subtle uppercase tracking-widest">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(item => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-adm-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`w-1 h-3.5 rounded-full shrink-0 ${active ? 'bg-brand-400' : ''}`} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
