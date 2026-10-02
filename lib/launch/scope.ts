// Launch scope: which product surfaces the CURRENT public product shows.
//
// Pure module (no Next/Supabase imports) so Node tests can pin the launch
// shape. The deferred products (Classroom, Homeschool, Learning Tools,
// Writer Studio, Publishing, teen/adult audiences) stay in the codebase
// and come back by flipping one app_settings flag each — nothing here
// deletes or reconstructs them.

export interface LaunchFlags {
  classroom: boolean
  homeschool: boolean
  learningTools: boolean
  writerStudio: boolean
  publishing: boolean
  /** Teen + adult audiences (and the 18+ consent flow) in the public wizard. */
  extendedAudiences: boolean
}

/** One authoritative app_settings key per product area. */
export const LAUNCH_FLAG_KEYS: Record<keyof LaunchFlags, string> = {
  classroom: 'classroom_enabled',
  homeschool: 'homeschool_enabled',
  learningTools: 'learning_tools_enabled',
  writerStudio: 'writer_studio_enabled',
  publishing: 'publishing_requests_enabled',
  extendedAudiences: 'extended_audiences_enabled',
}

/** Current public launch: children's books only. A missing row means OFF. */
export const LAUNCH_DEFAULTS: LaunchFlags = {
  classroom: false,
  homeschool: false,
  learningTools: false,
  writerStudio: false,
  publishing: false,
  extendedAudiences: false,
}

export type ProductArea = Exclude<keyof LaunchFlags, 'extendedAudiences'>

export interface NavLink { href: string; label: string }

/** The four consumer book choices of the launch; Educator is never public here. */
export const LAUNCH_PLAN_TIERS = ['free', 'single', 'story_pack', 'story_pro'] as const

export const ALL_AUDIENCE_TIERS = ['child', 'teen', 'adult'] as const
export type AudienceTier = typeof ALL_AUDIENCE_TIERS[number]

/** Desktop header links, in display order. */
export function navLinks(flags: LaunchFlags): NavLink[] {
  const out: NavLink[] = [{ href: '/create', label: 'Create a Story' }]
  if (flags.learningTools) out.push({ href: '/learning', label: 'Learning' })
  if (flags.homeschool) out.push({ href: '/homeschool', label: 'Homeschool' })
  if (flags.classroom) out.push({ href: '/classroom', label: 'Classroom' })
  if (flags.writerStudio) out.push({ href: '/writer', label: 'Writer Studio' })
  out.push({ href: '/pricing', label: 'Pricing' })
  return out
}

/** Mobile hamburger menu: same set as the header. */
export function mobileMenuLinks(flags: LaunchFlags): NavLink[] {
  return navLinks(flags).map(l => (l.href === '/create' ? { ...l, label: 'Create a story' } : l))
}

/** Mobile bottom tab bar hrefs (Account is appended by the component). */
export function mobileTabHrefs(flags: LaunchFlags): string[] {
  const out = ['/', '/create']
  if (flags.learningTools) out.push('/learning')
  if (flags.classroom) out.push('/classroom')
  if (flags.writerStudio) out.push('/writer')
  return out
}

/** Footer links, in display order. */
export function footerLinks(flags: LaunchFlags): NavLink[] {
  const out: NavLink[] = [{ href: '/create', label: 'Create' }]
  if (flags.learningTools) out.push({ href: '/learning', label: 'Learning' })
  if (flags.homeschool) out.push({ href: '/homeschool', label: 'Homeschool' })
  if (flags.classroom) out.push({ href: '/classroom', label: 'Classroom' })
  out.push({ href: '/pricing', label: 'Pricing' }, { href: '/contact', label: 'Contact' }, { href: '/privacy', label: 'Privacy' }, { href: '/terms', label: 'Terms' })
  return out
}

/** Which product area a public path belongs to, if any. */
export function productAreaForPath(pathname: string): ProductArea | null {
  if (/^\/classroom(\/|$)/.test(pathname)) return 'classroom'
  if (/^\/homeschool(\/|$)/.test(pathname)) return 'homeschool'
  if (/^\/learning(\/|$)/.test(pathname)) return 'learningTools'
  if (/^\/writer(\/|$)/.test(pathname)) return 'writerStudio'
  if (/^\/publish(\/|$)/.test(pathname)) return 'publishing'
  return null
}

export type RoutePolicy = 'allow' | 'unavailable'

/**
 * Direct visits to a hidden product route render an intentional
 * "not available yet" page (never the unfinished product, never a 404
 * for a real route). Admins always pass so the Founder can keep using
 * the underlying systems.
 */
export function routePolicy(pathname: string, flags: LaunchFlags, isAdmin = false): RoutePolicy {
  const area = productAreaForPath(pathname)
  if (!area) return 'allow'
  if (isAdmin) return 'allow'
  return flags[area] ? 'allow' : 'unavailable'
}

/** Audience tiers the public wizard offers. */
export function publicAudienceTiers(flags: LaunchFlags): readonly AudienceTier[] {
  return flags.extendedAudiences ? ALL_AUDIENCE_TIERS : (['child'] as const)
}

/** Signup roles offered; the educator/student roles belong to the Classroom product. */
export function signupRoles(flags: LaunchFlags): Array<'parent' | 'educator' | 'student'> {
  return flags.classroom ? ['parent', 'educator', 'student'] : ['parent']
}

/** Homepage secondary sections. */
export function homepageSections(flags: LaunchFlags): { secondaryProducts: boolean; writerStudio: boolean } {
  return {
    secondaryProducts: flags.learningTools || flags.classroom || flags.homeschool,
    writerStudio: flags.writerStudio,
  }
}

/** Human copy for the unavailable state, per area. */
export const AREA_LABELS: Record<ProductArea, string> = {
  classroom: 'Classroom',
  homeschool: 'Homeschool',
  learningTools: 'Learning Tools',
  writerStudio: 'Writer Studio',
  publishing: 'Publishing',
}
