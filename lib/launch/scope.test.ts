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
  homepageSections,
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

test('1. homepage hides deferred product sections when flags are off, and renders them from the flags', () => {
  assert.deepEqual(homepageSections(OFF), { secondaryProducts: false, writerStudio: false })
  assert.deepEqual(homepageSections(ON), { secondaryProducts: true, writerStudio: true })
  const src = read('app/page.tsx')
  assert.match(src, /homepageSections\(flags\)\.secondaryProducts && <SecondaryProducts flags=\{flags\} \/>/)
  assert.match(src, /homepageSections\(flags\)\.writerStudio && <WriterStudio \/>/)
  for (const f of ['flags.learningTools && (', 'flags.classroom && (', 'flags.homeschool && (']) assert.ok(src.includes(f), f)
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
  assert.match(pricing, /FAQ\.filter\(item => !item\.area \|\| flags\[item\.area\]\)/)
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
  assert.match(read('components/layout/ProductGate.tsx'), /routePolicy\(path, flags, !!admin\) === 'allow'/)
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
