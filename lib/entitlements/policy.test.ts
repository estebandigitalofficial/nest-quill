import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TIER_CAPS, FREE_LIFETIME_BOOKS, FREE_GUEST_BOOKS, LAUNCH_TIERS,
  applyCaps, clampPages, pdfEntitledFor, periodAllowanceFor, isLaunchTier, legacyLabelGrantsEntitlement, deny,
} from './policy.ts'

test('tier caps match the Founder ladder', () => {
  assert.equal(TIER_CAPS.free.maxPages, 8)
  assert.deepEqual([...TIER_CAPS.free.styles], ['watercolor'])
  assert.equal(TIER_CAPS.free.dedication, false)
  assert.equal(TIER_CAPS.free.pdf, false)
  assert.equal(TIER_CAPS.single.maxPages, 16)
  assert.equal(TIER_CAPS.story_pack.maxPages, 24)
  assert.equal(TIER_CAPS.story_pro.maxPages, 32)
  for (const t of ['single', 'story_pack', 'story_pro'] as const) {
    assert.equal(TIER_CAPS[t].styles.length, 5)
    assert.equal(TIER_CAPS[t].dedication, true)
    assert.equal(TIER_CAPS[t].pdf, true)
  }
  assert.equal(periodAllowanceFor('story_pack'), 3)
  assert.equal(periodAllowanceFor('story_pro'), 6)
  assert.equal(FREE_LIFETIME_BOOKS, 2)
  assert.equal(FREE_GUEST_BOOKS, 1)
})

test('no rollover assumption exists anywhere in the entitlement code', () => {
  for (const f of ['lib/entitlements/policy.ts', 'lib/entitlements/reserve.ts', 'lib/entitlements/supabaseStore.ts', 'supabase/migrations/20240068_entitlement_foundation.sql']) {
    const src = readFileSync(f, 'utf8')
    // Identifiers only: a comment may say "no rollover", code may not implement one.
    assert.doesNotMatch(src, /carried_over|carry_over|rollover_|rolloverCap|ROLLOVER/, `${f} implements rollover`)
  }
  // Launch tiers only: the hidden Educator block keeps its legacy copy for compatibility.
  const cfg = readFileSync('lib/plans/config.ts', 'utf8')
  const launchBlock = cfg.slice(cfg.indexOf('  free: {'), cfg.indexOf('  educator: {'))
  assert.ok(launchBlock.length > 500)
  assert.doesNotMatch(launchBlock, /roll over|Priority processing/i)
})

test('Free is clamped to 8 pages; Single 16; Pack 24; Pro 32', () => {
  const sub = (len: number) => ({ storyLength: len, illustrationStyle: 'watercolor', dedicationText: null })
  const pages = (tier: 'free' | 'single' | 'story_pack' | 'story_pro', len: number) => {
    const r = applyCaps(tier, sub(len)); assert.ok(r.ok); return r.storyLength
  }
  assert.equal(pages('free', 32), 8)
  assert.equal(pages('single', 32), 16)
  assert.equal(pages('story_pack', 32), 24)
  assert.equal(pages('story_pro', 32), 32)
  assert.equal(pages('story_pro', 16), 16)
  assert.equal(clampPages(999, 24), 24)
  assert.equal(clampPages(0, 8), 8)
})

test('Free accepts Watercolor only; paid tiers accept every launch style', () => {
  const bad = applyCaps('free', { storyLength: 8, illustrationStyle: 'cartoon' })
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.code, 'STYLE_NOT_ALLOWED')
  assert.equal(applyCaps('free', { storyLength: 8, illustrationStyle: 'watercolor' }).ok, true)
  for (const style of ['watercolor', 'cartoon', 'storybook', 'pencil_sketch', 'digital_art']) {
    assert.equal(applyCaps('single', { storyLength: 8, illustrationStyle: style }).ok, true, style)
  }
  assert.equal(applyCaps('single', { storyLength: 8, illustrationStyle: 'oil_painting' }).ok, false)
})

test('Free dedication is removed server-side; paid keeps it; Free never gets PDF', () => {
  const free = applyCaps('free', { storyLength: 8, illustrationStyle: 'watercolor', dedicationText: 'For Nana' })
  assert.ok(free.ok)
  assert.equal(free.dedicationText, null)
  assert.equal(free.pdfEntitled, false)
  const single = applyCaps('single', { storyLength: 8, illustrationStyle: 'watercolor', dedicationText: 'For Nana' })
  assert.ok(single.ok)
  assert.equal(single.dedicationText, 'For Nana')
  assert.equal(single.pdfEntitled, true)
})

test('Educator is not a launch tier and cannot pass the public submit contract', () => {
  assert.equal(isLaunchTier('educator'), false)
  assert.equal((LAUNCH_TIERS as readonly string[]).includes('educator'), false)
  const validator = readFileSync('lib/validators/story-form.ts', 'utf8')
  assert.match(validator, /const PLAN_TIERS = \['free', 'single', 'story_pack', 'story_pro'\] as const/)
})

test('historical paid-looking labels never create entitlements', () => {
  assert.equal(legacyLabelGrantsEntitlement('story_pro'), false)
  assert.equal(legacyLabelGrantsEntitlement('single'), false)
  const sql = readFileSync('supabase/migrations/20240068_entitlement_foundation.sql', 'utf8')
  assert.doesNotMatch(sql, /INSERT INTO public\.story_purchases/i)
  assert.doesNotMatch(sql, /INSERT INTO public\.subscription_periods/i)
  assert.doesNotMatch(sql, /UPDATE public\.story_requests SET (entitlement_source|pdf_entitled)/i)
})

test('PDF authorization reads the entitlement snapshot, with the explicit legacy rule', () => {
  // New rows: snapshot wins, label is ignored.
  assert.equal(pdfEntitledFor({ entitlement_source: 'free', pdf_entitled: false, plan_tier: 'story_pro' }), false)
  assert.equal(pdfEntitledFor({ entitlement_source: 'purchase', pdf_entitled: true, plan_tier: 'free' }), true)
  assert.equal(pdfEntitledFor({ entitlement_source: 'admin', pdf_entitled: false, plan_tier: 'single' }), false)
  // Legacy rows: unchanged historical behaviour (any non-free label).
  assert.equal(pdfEntitledFor({ entitlement_source: null, pdf_entitled: false, plan_tier: 'single' }), true)
  assert.equal(pdfEntitledFor({ entitlement_source: null, pdf_entitled: false, plan_tier: 'free' }), false)
  assert.equal(pdfEntitledFor({ entitlement_source: undefined, plan_tier: 'story_pro' }), true)
})

test('PDF route, status route, reader, drip email and cron converge on pdfEntitledFor', () => {
  assert.match(readFileSync('app/api/story/[requestId]/generate-pdf/route.ts', 'utf8'), /pdfEntitledFor\(/)
  assert.doesNotMatch(readFileSync('app/api/story/[requestId]/generate-pdf/route.ts', 'utf8'), /plan_tier === 'free'/)
  const status = readFileSync('app/api/story/status/route.ts', 'utf8')
  assert.match(status, /pdfEntitled = pdfEntitledFor\(storyRequest\)/)
  assert.match(status, /else if \(pdfEntitled\)/)
  assert.doesNotMatch(status, /storyRequest\.plan_tier !== 'free'/)
  const reader = readFileSync('components/story/StoryStatusPage.tsx', 'utf8')
  assert.match(reader, /typeof pdfEntitled === 'boolean' \? pdfEntitled : planTier !== 'free'/)
  assert.match(readFileSync('app/api/cron/drip-emails/route.ts', 'utf8'), /pdfEntitled: pdfEntitledFor\(/)
})

test('Beta Mode cannot bypass entitlement enforcement', () => {
  for (const f of ['lib/entitlements/policy.ts', 'lib/entitlements/reserve.ts', 'lib/entitlements/supabaseStore.ts', 'app/api/story/submit/route.ts']) {
    const src = readFileSync(f, 'utf8')
    assert.doesNotMatch(src, /beta_mode_enabled|betaMode/, `${f} reads Beta Mode`)
  }
  // The old bypass module is gone and nothing imports it.
  assert.throws(() => readFileSync('lib/plans/limits.ts', 'utf8'))
  assert.doesNotMatch(readFileSync('app/api/story/submit/route.ts', 'utf8'), /canCreateBook|NEXT_PUBLIC_PAYMENTS_ENABLED/)
})

test('denials carry stable codes and statuses the wizard understands', () => {
  assert.equal(deny('ACCOUNT_REQUIRED').status, 403)
  assert.equal(deny('GUEST_LIMIT_EXCEEDED').requiresSignup, true)
  assert.equal(deny('PLAN_LIMIT_EXCEEDED').status, 403)
  assert.equal(deny('ENTITLEMENT_REQUIRED').status, 402)
})
