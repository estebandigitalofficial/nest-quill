import { notFound } from 'next/navigation'
import { getAdminContext } from '@/lib/admin/guard'
import { getLaunchFlags } from '@/lib/launch/flags'
import { routePolicy, type ProductArea } from '@/lib/launch/scope'

/**
 * Wraps a deferred product area (Classroom, Homeschool, Learning Tools,
 * Writer Studio, Publishing). While its launch flag is off, public visitors
 * get the site's not-found page BEFORE the area's pages render, so nothing
 * of the hidden product reaches the browser (not even the page payload) and
 * nothing advertises a future product. Admins pass through so the Founder
 * can keep using the system. Flipping the flag restores the area with no
 * code change.
 *
 * Launch commercial reconciliation (2026-10): the former per-area landing
 * page ("will open in a later release") was a public promise of deferred
 * products and was removed; hidden routes are now indistinguishable from
 * unknown routes to the public.
 */
export default async function ProductGate({ area, path, children }: { area: ProductArea; path: string; children: React.ReactNode }) {
  const [flags, admin] = await Promise.all([getLaunchFlags(), getAdminContext()])
  if (routePolicy(path, flags, !!admin) !== 'allow') notFound()
  return <>{children}</>
}
