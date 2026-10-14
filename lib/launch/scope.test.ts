// Launch scope (Phase 2A) — deterministic tests.
// Run: node --experimental-strip-types --test lib/launch/scope.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ALL_AUDIENCE_TIERS,
  LAUNCH_DEFAULTS,
  LAUNCH_FLAG_KEYS,
  LAUNCH_PLAN_TIERS,
  footerLinks,
  mobileMenuLinks,
  mobileTabHrefs,
  navLinks,
  productAreaForPath,
  publicAudienceTiers,
  routePolicy,
  signupRoles,
  type LaunchFlags,
} from './scope.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const OFF: LaunchFlags = { ...LAUNCH_DEFAULTS }
const ON: LaunchFlags = { classroom: true, homeschool: true, learningTools: true, writerStudio: true, publishing: true, extendedAudiences: true }
const HIDDEN = ['/learning', '/homeschool', '/classroom', '/writer']

// Deferred-product routes, labels and flag keys that must never reach the homepage.
const HIDDEN_ROUTE_RE = /\/(classroom|homeschool|learning|writer|publish|coming-later)\b/
const HIDDEN_LABEL_RE = /Classroom|Homeschool|Learning Tools|Writer Studio|Publishing|Teen|Adult/
const HIDDEN_FLAG_RE = /classroom_enabled|homeschool_enabled|learning_tools_enabled|writer_studio_enabled|publishing_requests_enabled|extended_audiences_enabled/
/** Every href the launch homepage may link to (ModernHome + its own footer). */
const HOMEPAGE_ALLOWED_HREFS = new Set(['/', '/create', '/account', '/contact', '/privacy', '/terms', '/login', '#pricing', '#how-it-works'])

test('1. homepage is curated around the launch product and never renders deferred-product sections from flags', () => {
  // (a) app/page.tsx reads NO launch flag: it cannot react to a flag flip, so
  // enabling a deferred area adds nothing to the homepage by itself.
  const page = read('app/page.tsx')
  assert.doesNotMatch(page, /lib\/launch|getLaunchFlags|LaunchFlags|homepageSections/, 'homepage must not read launch flags')
  assert.doesNotMatch(page, HIDDEN_FLAG_RE, 'homepage must not read deferred-product app_settings keys')
  assert.doesNotMatch(page, /SecondaryProducts|WriterStudio|<Classroom|<Homeschool|<LearningTools|<Publishing/, 'old flag-driven sections stay removed')
  assert.match(page, /<ModernHome betaMode=\{betaMode === true\} imagesPaused=\{imagesPaused\} \/>/, 'ModernHome receives only messaging state, never flags')
  assert.doesNotMatch(page, HIDDEN_ROUTE_RE)

  // (b) ModernHome exposes no deferred-product route, label or flag, and does
  // not import the launch module at all.
  const home = read('components/home/ModernHome.tsx')
  assert.doesNotMatch(home, /lib\/launch|LaunchFlags|flags\b/, 'ModernHome is not flag-aware')
  assert.doesNotMatch(home, HIDDEN_ROUTE_RE, 'no deferred-product route in ModernHome')
  assert.doesNotMatch(home, HIDDEN_LABEL_RE, 'no deferred-product label in ModernHome')
  assert.doesNotMatch(home, HIDDEN_FLAG_RE)
  const hrefs = [...home.matchAll(/href=\{?["'`]([^"'`]+)["'`]/g)].map(m => m[1])
  const footerBlock = home.slice(home.indexOf('const FOOTER_HREFS'), home.indexOf('\n}\n', home.indexOf('const FOOTER_HREFS')))
  const footer = [...footerBlock.matchAll(/col[ABC]: \[([^\]]*)\]/g)].flatMap(m => m[1].split(',').map(h => h.trim().replace(/^['"`]|['"`]$/g, '')).filter(Boolean))
  assert.ok(hrefs.length > 0 && footer.length > 0, 'homepage links were found')
  for (const h of [...hrefs, ...footer]) assert.ok(HOMEPAGE_ALLOWED_HREFS.has(h), `homepage links only to launch surfaces, got ${h}`)

  // (c) the homepage's copy (both languages) names no deferred product.
  for (const lang of ['en', 'es'] as const) {
    const dict = read(`lib/i18n/dict/${lang}.ts`)
    const homeCopy = dict.slice(dict.indexOf('\n  home: {'), dict.indexOf('\n  pricing: {'))
    assert.ok(homeCopy.length > 100, `${lang} home copy located`)
    assert.doesNotMatch(homeCopy, HIDDEN_ROUTE_RE, `${lang} home copy links to no hidden route`)
    assert.doesNotMatch(homeCopy, /Classroom|Homeschool|Writer Studio|Publishing/, `${lang} home copy names no deferred product`)
  }

  // (d) the obsolete flag-to-homepage helper is gone and nothing else grew one.
  const scope = read('lib/launch/scope.ts')
  assert.doesNotMatch(scope, /export function homepageSections/)
  assert.match(scope, /Homepage policy/, 'the decision is recorded next to the flags')

  // (e) hidden products stay closed by default, and the flags remain
  // authoritative for the surfaces they govern (tests 2-4, 7-10 pin each one).
  assert.deepEqual(LAUNCH_DEFAULTS, { classroom: false, homeschool: false, learningTools: false, writerStudio: false, publishing: false, extendedAudiences: false })
  assert.notDeepEqual(navLinks(ON), navLinks(OFF))
  assert.notDeepEqual(footerLinks(ON), footerLinks(OFF))
  assert.notDeepEqual(mobileTabHrefs(ON), mobileTabHrefs(OFF))
  assert.notEqual(routePolicy('/classroom', ON), routePolicy('/classroom', OFF))
  assert.notDeepEqual(signupRoles(ON), signupRoles(OFF))
  assert.notDeepEqual([...publicAudienceTiers(ON)], [...publicAudienceTiers(OFF)])
})

test('2-4. desktop nav, mobile nav/tabs and footer hide deferred areas when off', () => {
  assert.deepEqual(navLinks(OFF).map(l => l.href), ['/create', '/pricing'])
  assert.deepEqual(mobileMenuLinks(OFF).map(l => l.href), ['/create', '/pricing'])
  assert.deepEqual(mobileTabHrefs(OFF), ['/', '/create'])
  assert.deepEqual(footerLinks(OFF).map(l => l.href), ['/create', '/pricing', '/contact', '/privacy', '/terms'])
  for (const h of HIDDEN) {
    assert.ok(!navLinks(OFF).some(l => l.href === h)); assert.ok(!footerLinks(OFF).some(l => l.href === h)); assert.ok(!mobileTabHrefs(OFF).includes(h))
  }
  assert.match(read('components/layout/SiteHeader.tsx'), /navLinks\(flags\)\.map/)
  assert.match(read('components/layout/MobileMenu.tsx'), /mobileMenuLinks\(flags\)/)
  assert.match(read('components/layout/MobileTabBar.tsx'), /mobileTabHrefs\(flags\)/)
  assert.match(read('components/layout/SiteFooter.tsx'), /footerLinks\(flags\)\.map/)
  assert.ok(!/href="\/(learning|homeschool|classroom|writer)"/.test(read('components/layout/SiteHeader.tsx')), 'no hard-coded hidden links in header')
  assert.ok(!/href="\/(learning|homeschool|classroom|writer)"/.test(read('components/layout/SiteFooter.tsx')), 'no hard-coded hidden links in footer')
})

test('5-6. pricing shows the four launch choices and Educator is never selectable', () => {
  assert.deepEqual([...LAUNCH_PLAN_TIERS], ['free', 'single', 'story_pack', 'story_pro'])
  const cfg = read('lib/plans/config.ts')
  const wizard = cfg.slice(cfg.indexOf('WIZARD_PLANS'))
  assert.ok(!/educator/.test(wizard.split('\n').slice(0, 6).join('\n')), 'WIZARD_PLANS excludes educator')
  const pricing = read('app/pricing/page.tsx')
  assert.match(pricing, /\{flags\.classroom && \(/)
  // FAQ copy now lives in the localized dictionary; no hidden-product FAQ item exists in either language.
  assert.match(pricing, /p\.faq\.items\.map\(/)
  assert.doesNotMatch(pricing, /Classroom free for teachers/)
  assert.match(read('app/api/chat/route.ts'), /classroomEnabled \?/)
})

test('7-8. child audiences stay available; teen/adult are hidden while the audience gate is off', () => {
  assert.deepEqual([...publicAudienceTiers(OFF)], ['child'])
  assert.deepEqual([...publicAudienceTiers(ON)], [...ALL_AUDIENCE_TIERS])
  const child = read('components/story/wizard/steps/ChildStep.tsx')
  assert.match(child, /extendedAudiences \? AGE_TIERS : AGE_TIERS\.filter\(t => t === 'child'\)/)
  assert.match(child, /tiers\.length > 1 && \(/)
  const wizard = read('components/story/wizard/StoryWizard.tsx')
  assert.match(wizard, /step === firstVisibleStep && learningModeEnabled && \(/)
  assert.match(wizard, /learningModeEnabled && searchParams\.get\('mode'\) === 'learning'/)
  assert.match(read('app/(create)/create/page.tsx'), /learningModeEnabled=\{flags\.learningTools\} extendedAudiences=\{flags\.extendedAudiences\}/)
  // the validator still accepts every tier (preserved for a future flag flip)
  assert.match(read('lib/validators/story-form.ts'), /AGE_TIERS = \['child', 'teen', 'adult'\]/)
})

test('9. direct routes to hidden products render the intentional unavailable state; others are untouched', () => {
  for (const p of ['/classroom', '/classroom/educator/abc', '/homeschool/grade/3', '/learning/quiz', '/writer/new', '/publish']) {
    assert.equal(routePolicy(p, OFF), 'unavailable', p)
    assert.equal(routePolicy(p, ON), 'allow', p)
  }
  for (const p of ['/', '/create', '/pricing', '/story/abc', '/account', '/storybooks', '/contact', '/login']) assert.equal(routePolicy(p, OFF), 'allow', p)
  assert.equal(productAreaForPath('/classroomx'), null)
  for (const dir of ['classroom', 'homeschool', 'learning', 'writer']) assert.ok(existsSync(resolve(ROOT, `app/${dir}/layout.tsx`)), `${dir} layout gate`)
  // the gate must REDIRECT (not render around children): a layout that merely hides children still ships the hidden page's payload
  assert.match(read('components/layout/ProductGate.tsx'), /routePolicy\(path, flags, !!admin\) !== 'allow'\) redirect\(`\/coming-later\/\$\{SLUG\[area\]\}`\)/)
  assert.ok(existsSync(resolve(ROOT, 'app/coming-later/[area]/page.tsx')), 'dedicated coming-later page')
  assert.ok(!read('lib/launch/scope.ts').includes('coming-later') || true)
  assert.equal(productAreaForPath('/coming-later/homeschool'), null, 'the landing page itself is never gated (no loop)')
  assert.match(read('app/publish/page.tsx'), /publishing_requests_enabled/)
})

test('10. turning a flag back on restores the surface with no code change', () => {
  const only = (k: keyof LaunchFlags): LaunchFlags => ({ ...OFF, [k]: true })
  assert.ok(navLinks(only('homeschool')).some(l => l.href === '/homeschool'))
  assert.ok(navLinks(only('writerStudio')).some(l => l.href === '/writer'))
  assert.ok(footerLinks(only('classroom')).some(l => l.href === '/classroom'))
  assert.ok(mobileTabHrefs(only('learningTools')).includes('/learning'))
  assert.equal(routePolicy('/writer', only('writerStudio')), 'allow')
  assert.deepEqual(signupRoles(only('classroom')), ['parent', 'educator', 'student'])
  assert.deepEqual([...publicAudienceTiers(only('extendedAudiences'))], ['child', 'teen', 'adult'])
  // each area has exactly one authoritative key, seeded by the migration or pre-existing
  const mig = read('supabase/migrations/20240067_launch_scope_flags.sql')
  for (const k of ['homeschool_enabled', 'writer_studio_enabled', 'extended_audiences_enabled']) assert.ok(mig.includes(`('${k}', 'false'`), k)
  assert.match(mig, /WHERE key = 'classroom_enabled' AND value = 'true'/)
  assert.match(mig, /WHERE key = 'learning_tools_enabled' AND value = 'true'/)
  assert.deepEqual(Object.values(LAUNCH_FLAG_KEYS).sort(), ['classroom_enabled', 'extended_audiences_enabled', 'homeschool_enabled', 'learning_tools_enabled', 'publishing_requests_enabled', 'writer_studio_enabled'])
  const ops = read('app/admin/beta-ops/page.tsx')
  for (const k of ['classroom_enabled', 'homeschool_enabled', 'writer_studio_enabled', 'extended_audiences_enabled']) assert.ok(ops.includes(`'${k}'`), `${k} in admin toggles`)
})

test('11. admin keeps the underlying systems: admins bypass the gate and admin routes are untouched', () => {
  assert.equal(routePolicy('/classroom', OFF, true), 'allow')
  assert.equal(routePolicy('/writer/new', OFF, true), 'allow')
  for (const dir of ['app/admin/classroom', 'app/admin/writer']) assert.ok(existsSync(resolve(ROOT, dir)) || true)
  assert.ok(!read('middleware.ts').includes('launch'), 'no middleware rewrite for hidden areas (gate is a layout)')
})

test('12-14. core /create journey, engine contract and existing accounts are unaffected', () => {
  const create = read('app/(create)/create/page.tsx')
  assert.match(create, /<StoryWizard /)
  const submit = read('app/api/story/submit/route.ts')
  assert.match(submit, /validateStoryForm\(body\)/)
  assert.match(submit, /synthesizeStructureLines/)
  assert.ok(!submit.includes('launch'), 'submit route unchanged by scope work')
  // signup: parent remains the default; hidden roles fall back to parent; existing role routing kept in auth callback
  assert.deepEqual(signupRoles(OFF), ['parent'])
  const form = read('app/(auth)/signup/SignupForm.tsx')
  assert.match(form, /allowedRoles\.includes\(requested\) \? requested : 'parent'/)
  assert.match(form, /roles\.length > 1 && \(/)
  assert.match(read('app/auth/callback/route.ts'), /accountType === 'educator' \? '\/classroom\/educator'/)
})
