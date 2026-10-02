// Admin information architecture (Phase 2B) — deterministic tests.
// Run: node --experimental-strip-types --test lib/admin/nav.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ADMIN_BOTTOM_TABS,
  ADMIN_NAV,
  CURRENT_SETTING_KEYS,
  EXPANDED_HUB_HREF,
  LAUNCH_SCOPE_SETTING_KEYS,
  SETTINGS_SECTION_SCOPE,
  adminScopeForPath,
  navGroups,
  navHrefs,
} from './nav.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const pageExists = (route: string) => existsSync(resolve(ROOT, 'app' + route + '/page.tsx'))

test('1. CURRENT navigation holds the children\'s-book operations', () => {
  const current = navHrefs('current')
  for (const h of ['/admin', '/admin/library', '/admin/images', '/admin/users', '/admin/guests', '/admin/beta-ops', '/admin/beta-readiness', '/admin/support', '/admin/reporting', '/admin/writer-config', '/admin/settings', '/admin/beta', '/admin/email-drips']) assert.ok(current.includes(h), h)
  for (const h of ['/admin/classrooms', '/admin/writer', '/admin/sponsors', '/admin/tours', '/admin/university']) assert.ok(!current.includes(h), `${h} must not be CURRENT`)
})

test('2-5. EXPANDED navigation holds the deferred systems and each stays reachable', () => {
  const expanded = navHrefs('expanded')
  assert.deepEqual([...expanded].sort(), ['/admin/classrooms', '/admin/sponsors', '/admin/tours', '/admin/university', '/admin/writer'])
  for (const h of expanded) assert.ok(pageExists(h), `${h} page exists`)
  assert.ok(expanded.includes('/admin/classrooms'), '3. Classroom reachable')
  assert.ok(expanded.includes('/admin/writer'), '4. Writer reachable')
  assert.ok(expanded.includes('/admin/university'), '5. Learning (University) reachable; Homeschool has no admin route by design')
  assert.ok(pageExists(EXPANDED_HUB_HREF), 'expanded hub page exists')
  const sidebar = read('components/admin/AdminSidebar.tsx')
  assert.match(sidebar, /navGroups\('current'\)/); assert.match(sidebar, /navGroups\('expanded'\)/); assert.match(sidebar, /EXPANDED_HUB_HREF/)
  assert.ok(sidebar.includes('>Current<') && sidebar.includes('>Expanded<'), 'explicit CURRENT / EXPANDED labels')
})

test('6. CURRENT settings expose the launch controls first', () => {
  assert.deepEqual([...CURRENT_SETTING_KEYS], ['maintenance_mode_enabled', 'beta_mode_enabled', 'image_generation_enabled', 'pdf_download_enabled', 'guest_story_limit', 'free_user_story_limit', 'stuck_story_threshold_minutes'])
  const hub = read('app/admin/settings/SettingsHub.tsx')
  const firstSection = hub.slice(hub.indexOf('const SECTIONS: SectionDef[] = ['), hub.indexOf('const SECTIONS: SectionDef[] = [') + 1500)
  assert.match(firstSection, /id: 'current',\s*scope: 'current',\s*label: 'Launch Controls'/)
  for (const k of CURRENT_SETTING_KEYS) assert.ok(firstSection.includes(`key: '${k}'`), k)
  for (const k of LAUNCH_SCOPE_SETTING_KEYS) assert.ok(!firstSection.includes(`key: '${k}'`), `${k} must not be in the primary launch controls`)
  assert.equal(SETTINGS_SECTION_SCOPE.current, 'current'); assert.equal(SETTINGS_SECTION_SCOPE.flags, 'expanded'); assert.equal(SETTINGS_SECTION_SCOPE.learning, 'expanded')
  assert.match(hub, /\(\['current', 'expanded'\] as const\)\.map\(scope =>/)
})

test('7. the full Phase 2A controls remain in EXPANDED / Beta Ops', () => {
  const ops = read('app/admin/beta-ops/page.tsx')
  for (const k of LAUNCH_SCOPE_SETTING_KEYS) assert.ok(ops.includes(`'${k}'`), `${k} in Beta Ops`)
  assert.match(ops, /Expanded products — public visibility/)
  const toggles = read('app/admin/beta-ops/BetaOpsToggles.tsx')
  for (const k of LAUNCH_SCOPE_SETTING_KEYS) assert.ok(toggles.includes(`'${k}'`), `${k} enforced`)
})

test('8. every linked /admin route exists; no route was deleted', () => {
  for (const g of ADMIN_NAV) for (const i of g.items) assert.ok(pageExists(i.href), i.href)
  for (const t of ADMIN_BOTTOM_TABS) assert.ok(pageExists(t.href), t.href)
  for (const legacy of ['/admin/beta', '/admin/beta-ops', '/admin/classrooms', '/admin/email-drips', '/admin/guests', '/admin/images', '/admin/library', '/admin/reporting', '/admin/settings', '/admin/sponsors', '/admin/support', '/admin/tours', '/admin/university', '/admin/users', '/admin/writer', '/admin/writer-config']) assert.ok(pageExists(legacy), legacy)
})

test('9. admin authorization is unchanged', () => {
  const layout = read('app/admin/layout.tsx')
  assert.match(layout, /const ctx = await getAdminContext\(\)/)
  assert.match(read('app/admin/expanded/page.tsx'), /const ctx = await getAdminContext\(\)\s*\n\s*if \(!ctx\) return null/)
  assert.match(read('lib/admin/guard.ts'), /isAdminByProfile|isAdminByEnv/)
})

test('10-11. public navigation and the story-engine contract are untouched by Phase 2B', () => {
  const header = read('components/layout/SiteHeader.tsx')
  assert.match(header, /navLinks\(flags\)\.map/)
  assert.ok(!header.includes('lib/admin/nav'), 'public header does not import admin nav')
  assert.ok(!read('app/api/story/submit/route.ts').includes('lib/admin/nav'))
  assert.match(read('components/admin/AdminStoryActions.tsx'), /fetch\(`\/api\/admin\/stories\/\$\{requestId\}\/generate-images`, \{ method: 'POST' \}\)/)
})

test('12. mobile admin navigation stays structurally usable: CURRENT tabs plus one Expanded tab', () => {
  assert.deepEqual(ADMIN_BOTTOM_TABS.map(t => t.label), ['Home', 'Stories', 'Users', 'Ops', 'Expanded'])
  assert.equal(ADMIN_BOTTOM_TABS[ADMIN_BOTTOM_TABS.length - 1].href, EXPANDED_HUB_HREF)
  assert.match(read('components/admin/AdminBottomNav.tsx'), /ADMIN_BOTTOM_TABS\.map/)
  assert.equal(adminScopeForPath('/admin/classrooms/abc'), 'expanded')
  assert.equal(adminScopeForPath('/admin/stories/abc'), 'current')
  assert.equal(adminScopeForPath('/admin/library'), 'current')
  assert.equal(adminScopeForPath(EXPANDED_HUB_HREF), 'expanded')
  assert.equal(navGroups('current').length >= 3, true)
})

test('dangerous actions: expensive story actions ask for confirmation; recovery actions already did', () => {
  const sa = read('components/admin/AdminStoryActions.tsx')
  assert.equal((sa.match(/if \(!confirm\(/g) ?? []).length, 2, 'force requeue + generate images confirm')
  assert.match(read('components/admin/AdminRecoveryActions.tsx'), /if \(!confirm\(/)
  assert.match(read('components/admin/AdminQuickActions.tsx'), /\/admin\/beta-ops/)
  assert.match(read('app/admin/page.tsx'), /launchFlags\.classroom && \(/)
})
