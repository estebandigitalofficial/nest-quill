'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Sidebar groups for the Command Center. Each group has a small
// accent dot color so admins can scan the rail by mood/area.
//
// Status color language used across the admin:
//   green  — healthy / nominal
//   amber  — warning / watch
//   red    — action / critical
//   blue   — beta / informational
//   violet — AI / generation
//   gold   — billing / revenue
//
// Group accents below mirror this language where it makes sense
// (Operations = blue/beta, Growth = gold, System = white).

interface NavItem { href: string; label: string; exact?: boolean }
interface NavGroup { label: string; accent: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    accent: 'bg-amber-400',
    items: [
      { href: '/admin', label: 'Command Center', exact: true },
    ],
  },
  {
    label: 'Operations',
    accent: 'bg-sky-400',
    items: [
      { href: '/admin/beta-ops', label: 'Beta Ops' },
      { href: '/admin/support',  label: 'Support' },
      { href: '/admin/tours',    label: 'Tours' },
    ],
  },
  {
    label: 'Users & Stories',
    accent: 'bg-blue-400',
    items: [
      { href: '/admin/users',    label: 'Users' },
      { href: '/admin/guests',   label: 'Guests' },
      { href: '/admin/library',  label: 'Library' },
      { href: '/admin/images',   label: 'Images' },
    ],
  },
  {
    label: 'Learning & Classroom',
    accent: 'bg-emerald-400',
    items: [
      { href: '/admin/classrooms', label: 'Classrooms' },
      { href: '/admin/university', label: 'Bright Tale University' },
    ],
  },
  {
    label: 'Growth & Billing',
    accent: 'bg-yellow-300',
    items: [
      { href: '/admin/sponsors',     label: 'Sponsors' },
      { href: '/admin/reporting',    label: 'Reporting' },
      { href: '/admin/email-drips',  label: 'Email Drips' },
    ],
  },
  {
    label: 'Writer',
    accent: 'bg-fuchsia-400',
    items: [
      { href: '/admin/writer',        label: 'Books' },
      { href: '/admin/writer-config', label: 'AI Writer Config' },
    ],
  },
  {
    label: 'System',
    accent: 'bg-adm-text/60',
    items: [
      { href: '/admin/settings', label: 'Settings' },
      { href: '/admin/beta',     label: 'Beta Mode' },
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
          <div className="px-2 mb-1.5">
            <p className="text-[10px] font-medium text-adm-subtle uppercase tracking-[0.12em]">{group.label}</p>
          </div>
          <div className="space-y-0.5">
            {group.items.map(item => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-adm-surface text-adm-text font-medium'
                      : 'text-adm-muted hover:text-adm-text hover:bg-adm-surface/60'
                  }`}
                >
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
