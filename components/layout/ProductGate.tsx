import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin/guard'
import { getLaunchFlags } from '@/lib/launch/flags'
import { routePolicy, type ProductArea } from '@/lib/launch/scope'

const SLUG: Record<ProductArea, string> = { classroom: 'classroom', homeschool: 'homeschool', learningTools: 'learning', writerStudio: 'writer', publishing: 'publishing' }

/**
 * Wraps a deferred product area (Classroom, Homeschool, Learning Tools,
 * Writer Studio). While its launch flag is off, public visitors are
 * redirected to /coming-later/<area> BEFORE the area's pages render, so
 * nothing of the hidden product reaches the browser (not even the page
 * payload). Admins pass through so the Founder can keep using the system.
 * Flipping the flag restores the area with no code change.
 */
export default async function ProductGate({ area, path, children }: { area: ProductArea; path: string; children: React.ReactNode }) {
  const [flags, admin] = await Promise.all([getLaunchFlags(), getAdminContext()])
  if (routePolicy(path, flags, !!admin) !== 'allow') redirect(`/coming-later/${SLUG[area]}`)
  return <>{children}</>
}
