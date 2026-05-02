'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/admin', label: 'Stories', exact: true },
  { href: '/admin/library', label: 'Library' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/guests', label: 'Guests' },
  { href: '/admin/images', label: 'Images' },
  { href: '/admin/email-drips', label: 'Email Drips' },
  { href: '/admin/reporting', label: 'Reporting' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/writer-config', label: 'Writer' },
]

export default function AdminNavLinks() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {NAV_LINKS.map(({ href, label, exact }) => (
        <Link
          key={href}
          href={href}
          className={`text-xs transition-colors whitespace-nowrap ${
            isActive(href, exact)
              ? 'font-semibold text-white'
              : 'text-adm-muted hover:text-adm-text'
          }`}
        >
          {label}
        </Link>
      ))}
      <Link
        href="/admin/writer"
        className={`text-xs font-semibold transition-colors whitespace-nowrap ${
          pathname.startsWith('/admin/writer')
            ? 'text-brand-300'
            : 'text-brand-400 hover:text-brand-300'
        }`}
      >
        Book Writer →
      </Link>
    </>
  )
}
