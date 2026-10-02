import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getAdminContext } from '@/lib/admin/guard'
import { getLaunchFlags } from '@/lib/launch/flags'
import { AREA_LABELS, routePolicy, type ProductArea } from '@/lib/launch/scope'

/**
 * Wraps a deferred product area (Classroom, Homeschool, Learning Tools,
 * Writer Studio). While its launch flag is off, public visitors get an
 * intentional "not available yet" page instead of the unfinished product;
 * admins pass through so the Founder can keep using the system. Flipping
 * the flag restores the area with no code change.
 */
export default async function ProductGate({ area, path, children }: { area: ProductArea; path: string; children: React.ReactNode }) {
  const [flags, admin] = await Promise.all([getLaunchFlags(), getAdminContext()])
  if (routePolicy(path, flags, !!admin) === 'allow') return <>{children}</>
  const label = AREA_LABELS[area]
  return (
    <div className="min-h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Home</Link>} />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-md text-center space-y-4">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">Coming later</p>
          <h1 className="font-serif text-2xl text-oxford">{label} isn&apos;t available yet.</h1>
          <p className="text-sm text-charcoal-light">
            Right now Nest &amp; Quill is all about personalized, illustrated children&apos;s books. {label} will open in a later release.
          </p>
          <Link href="/create" className="inline-block bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors">
            Create a personalized story →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
