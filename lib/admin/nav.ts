// Admin information architecture (Phase 2B): CURRENT vs EXPANDED.
//
// CURRENT  = what the Founder needs to operate, observe and manage the
//            personalized children's-book business launching now.
// EXPANDED = preserved systems, future products, occasional administration
//            and development controls. Secondary, never disabled.
//
// Pure module (no Next/Supabase imports) so Node tests pin the layout.
// Navigation classification is separate from route existence: every
// /admin route keeps working whichever scope it is listed under.

export type AdminScope = 'current' | 'expanded'

export interface AdminNavItem { href: string; label: string; exact?: boolean; hint?: string }
export interface AdminNavGroup { scope: AdminScope; label: string; accent: string; items: AdminNavItem[] }

export const ADMIN_NAV: AdminNavGroup[] = [
  // ── CURRENT ────────────────────────────────────────────────────────────
  { scope: 'current', label: 'Overview', accent: 'bg-brand-500', items: [
    { href: '/admin', label: 'Command Center', exact: true, hint: 'Generation activity, failures, today' },
  ] },
  { scope: 'current', label: 'Books & Customers', accent: 'bg-blue-400', items: [
    { href: '/admin/library', label: 'Story Library', hint: 'Every story request and book' },
    { href: '/admin/images', label: 'Story Images', hint: 'Illustrations and backfill' },
    { href: '/admin/users', label: 'Users', hint: 'Accounts, plans, limits' },
    { href: '/admin/guests', label: 'Guests', hint: 'Guest submissions' },
    { href: '/admin/email-drips', label: 'Email Drips', hint: 'Customer email sequences' },
  ] },
  { scope: 'current', label: 'Operations', accent: 'bg-sky-400', items: [
    { href: '/admin/beta-ops', label: 'Beta Ops', hint: 'Queue, protection, emergency controls' },
    { href: '/admin/beta-readiness', label: 'Beta Readiness', hint: 'Launch checklist' },
    { href: '/admin/support', label: 'Support', hint: 'Tickets' },
    { href: '/admin/reporting', label: 'Reporting', hint: 'Stories, plans, styles' },
  ] },
  { scope: 'current', label: 'Story Engine & Settings', accent: 'bg-emerald-400', items: [
    { href: '/admin/writer-config', label: 'Story Prompts', hint: 'ai_writer_config: planning, prose, image rules' },
    { href: '/admin/settings', label: 'Settings', hint: 'Launch controls first' },
    { href: '/admin/beta', label: 'Beta Mode', hint: 'What beta changes' },
  ] },
  // ── EXPANDED ───────────────────────────────────────────────────────────
  { scope: 'expanded', label: 'Classroom & Learning', accent: 'bg-violet-400', items: [
    { href: '/admin/classrooms', label: 'Classrooms', hint: 'Educator product (public: off)' },
    { href: '/admin/university', label: 'Bright Tale University', hint: 'Curriculum generation' },
  ] },
  { scope: 'expanded', label: 'Writer Studio', accent: 'bg-amber-400', items: [
    { href: '/admin/writer', label: 'Writer Books', hint: 'Manuscripts, chapters, exports' },
  ] },
  { scope: 'expanded', label: 'Growth & Partners', accent: 'bg-pink-400', items: [
    { href: '/admin/sponsors', label: 'Sponsors', hint: 'Brand partners and rewards' },
  ] },
  { scope: 'expanded', label: 'Product Polish', accent: 'bg-adm-subtle', items: [
    { href: '/admin/tours', label: 'Guided Tours', hint: 'Onboarding overlays' },
  ] },
]

export const EXPANDED_HUB_HREF = '/admin/expanded'

export function navGroups(scope: AdminScope): AdminNavGroup[] {
  return ADMIN_NAV.filter(g => g.scope === scope)
}

export function navHrefs(scope: AdminScope): string[] {
  return navGroups(scope).flatMap(g => g.items.map(i => i.href))
}

/** Mobile bottom tabs: CURRENT first, EXPANDED hub last so it stays one tap away. */
export interface AdminTab { key: 'home' | 'stories' | 'users' | 'ops' | 'expanded'; label: string; href: string; activePaths: string[]; exactRoot?: boolean }
export const ADMIN_BOTTOM_TABS: AdminTab[] = [
  { key: 'home', label: 'Home', href: '/admin', activePaths: ['/admin'], exactRoot: true },
  { key: 'stories', label: 'Stories', href: '/admin/library', activePaths: ['/admin/library', '/admin/images', '/admin/stories'] },
  { key: 'users', label: 'Users', href: '/admin/users', activePaths: ['/admin/users', '/admin/guests', '/admin/support'] },
  { key: 'ops', label: 'Ops', href: '/admin/beta-ops', activePaths: ['/admin/beta-ops', '/admin/beta-readiness', '/admin/beta', '/admin/settings', '/admin/reporting', '/admin/writer-config', '/admin/email-drips'] },
  { key: 'expanded', label: 'Expanded', href: EXPANDED_HUB_HREF, activePaths: [EXPANDED_HUB_HREF, '/admin/classrooms', '/admin/university', '/admin/writer', '/admin/sponsors', '/admin/tours'] },
]

/** Which scope a given admin path belongs to (for headers and the bottom nav). */
export function adminScopeForPath(pathname: string): AdminScope | 'shared' {
  if (pathname === '/admin' || pathname === EXPANDED_HUB_HREF) return pathname === '/admin' ? 'current' : 'expanded'
  const match = (hrefs: string[]) => hrefs.some(h => pathname === h || pathname.startsWith(h + '/'))
  if (match(navHrefs('expanded'))) return 'expanded'
  if (match(navHrefs('current')) || pathname.startsWith('/admin/stories/')) return 'current'
  return 'shared'
}

/** The launch controls the Founder should see first in Settings. */
export const CURRENT_SETTING_KEYS = [
  'maintenance_mode_enabled',
  'beta_mode_enabled',
  'image_generation_enabled',
  'pdf_download_enabled',
  'guest_story_limit',
  'free_user_story_limit',
  'stuck_story_threshold_minutes',
] as const

/** Phase 2A public-visibility flags: EXPANDED / Beta Ops, never the primary settings surface. */
export const LAUNCH_SCOPE_SETTING_KEYS = [
  'classroom_enabled',
  'learning_tools_enabled',
  'publishing_requests_enabled',
  'homeschool_enabled',
  'writer_studio_enabled',
  'extended_audiences_enabled',
] as const

/** Settings-hub sections by scope. */
export const SETTINGS_SECTION_SCOPE: Record<string, AdminScope> = {
  current: 'current', plans: 'current', maintenance: 'current', notifications: 'current', email: 'current', branding: 'current',
  flags: 'expanded', learning: 'expanded', 'site-copy': 'expanded', publishing: 'expanded', safety: 'expanded', payments: 'expanded',
}
