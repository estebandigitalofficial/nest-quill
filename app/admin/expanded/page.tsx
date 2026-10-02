import Link from 'next/link'
import { getAdminContext } from '@/lib/admin/guard'
import { getLaunchFlags } from '@/lib/launch/flags'
import { LAUNCH_FLAG_KEYS, type LaunchFlags } from '@/lib/launch/scope'
import { navGroups } from '@/lib/admin/nav'

export const dynamic = 'force-dynamic'

// Phase 2B: the EXPANDED hub. Everything preserved for later — deferred
// products, partner tooling and occasional administration — in one place,
// with each area's public-visibility flag shown beside it. Nothing here is
// disabled; it is simply out of the daily CURRENT path.

const FLAG_FOR_HREF: Partial<Record<string, keyof LaunchFlags>> = {
  '/admin/classrooms': 'classroom',
  '/admin/university': 'learningTools',
  '/admin/writer': 'writerStudio',
}

export default async function ExpandedHubPage() {
  const ctx = await getAdminContext()
  if (!ctx) return null
  const flags = await getLaunchFlags()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-[11px] font-bold text-adm-subtle uppercase tracking-[0.18em]">Expanded</p>
        <h1 className="text-2xl font-semibold text-adm-text mt-1">Preserved &amp; future systems</h1>
        <p className="text-sm text-adm-muted mt-2 max-w-2xl">
          These systems stay fully functional for you but are outside the daily operation of the children&apos;s-book launch.
          Public visibility is governed by one flag per area (Beta Ops → Expanded products). Flipping a flag restores an area without any code change.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {navGroups('expanded').map(group => (
          <div key={group.label} className="bg-adm-surface rounded-2xl border border-adm-border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${group.accent}`} />
              <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest">{group.label}</h2>
            </div>
            <ul className="space-y-2">
              {group.items.map(item => {
                const flagKey = FLAG_FOR_HREF[item.href]
                const publicOn = flagKey ? flags[flagKey] : null
                return (
                  <li key={item.href} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={item.href} className="text-sm font-medium text-adm-text hover:underline">{item.label}</Link>
                      {item.hint && <p className="text-xs text-adm-subtle truncate">{item.hint}</p>}
                    </div>
                    {publicOn !== null && flagKey && (
                      <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${publicOn ? 'border-green-500/40 text-green-400' : 'border-adm-border text-adm-subtle'}`} title={`${LAUNCH_FLAG_KEYS[flagKey]} = ${publicOn}`}>
                        public {publicOn ? 'on' : 'off'}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-adm-surface rounded-2xl border border-adm-border p-5">
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-2">Public-visibility flags</h2>
        <p className="text-sm text-adm-muted">
          Classroom, Learning Tools, Publishing, Homeschool, Writer Studio and the teen/adult audiences are each controlled by one switch in{' '}
          <Link href="/admin/beta-ops" className="text-sky-300 hover:underline">Beta Ops → Expanded products</Link>.
        </p>
      </div>
    </div>
  )
}
