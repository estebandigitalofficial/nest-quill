import Link from 'next/link'

// Compact shortcut row near the top of the admin dashboard. The sidebar
// already covers full navigation; this is the single-tap row for tablet
// + the most common admin tasks.

interface ActionItem {
  href: string
  label: string
  hint: string
}

const ACTIONS: ActionItem[] = [
  { href: '/admin?view=recent-stories', label: 'Recent stories', hint: 'Last 24 h' },
  { href: '/admin/users',               label: 'Users',           hint: 'Plans & limits' },
  { href: '/admin/sponsors',            label: 'Sponsors',        hint: 'Brand partners' },
  { href: '/admin/settings',            label: 'Settings',        hint: 'Limits & flags' },
  { href: '/admin/writer',              label: 'AI Writer Config', hint: 'Prompt rules' },
]

export default function AdminQuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {ACTIONS.map(a => (
        <Link
          key={a.href}
          href={a.href}
          className="rounded-xl bg-adm-surface border border-adm-border hover:border-brand-600 px-3 py-2.5 transition-colors">
          <p className="text-xs font-semibold text-white">{a.label}</p>
          <p className="text-[10px] text-adm-subtle mt-0.5">{a.hint}</p>
        </Link>
      ))}
    </div>
  )
}
