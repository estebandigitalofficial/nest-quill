// Launch commercial truth (2026-10) — deterministic policy tests.
// Run: node --experimental-strip-types --test lib/launch/claims.test.ts
//
// Pins every CURRENT public commercial claim to the authoritative launch
// model in lib/entitlements/policy.ts (TIER_CAPS, Free allowances) so stale
// numbers (10-story Pro, $99/$249 yearly, print ordering, educator plans,
// "coming later" products) cannot quietly return. Assertions target numbers,
// keys and structure rather than exact marketing prose.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLAN_CONFIG, WIZARD_PLANS } from '../plans/config.ts'
import { FREE_GUEST_BOOKS, FREE_LIFETIME_BOOKS, TIER_CAPS, type LaunchTier } from '../entitlements/policy.ts'
import { dictionaries } from '../i18n/index.ts'
import { launchPricingKnowledge } from '../chat/launchKnowledge.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const LANGS = ['en', 'es'] as const
const LAUNCH: readonly LaunchTier[] = ['free', 'single', 'story_pack', 'story_pro']

/** Founder decisions the copy must agree with. */
const MODEL = {
  pages: { free: 8, single: 16, story_pack: 24, story_pro: 32 } as const,
  allowance: { story_pack: 3, story_pro: 6 } as const,
  price: { free: 0, single: 7.99, story_pack: 9.99, story_pro: 24.99 } as const,
  freeGuest: 1,
  freeLifetime: 2,
}

// Stale or deferred claims that must not appear in CURRENT customer copy.
// (Operational states such as "payments coming soon" during beta or "illustrations
// are paused" are not commercial claims and are not matched; neither is a
// negation such as "no annual plan".)
const STALE_RE = /10 stories|10 cuentos|\/yr\b|\/year\b|\/año\b|\$99\b|\$249\b|\$599\b|annual billing|billed annually|facturación anual|save \d+%|ahorra \d+%|print ordering|pedido impreso|priority processing|procesamiento prioritario|coming later|later release|próxima versión|Are you a teacher|maestro o maestra|educator plans? (are )?coming|planes para educadores/i

function flatten(node: unknown, path: string, out: Array<[string, string]>) {
  if (typeof node === 'string') out.push([path, node])
  else if (Array.isArray(node)) node.forEach((n, i) => flatten(n, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) flatten(v, path ? `${path}.${k}` : k, out)
}

test('1. the implementation is the founder launch model (pages 8/16/24/32, Free 1 guest / 2 lifetime, Pack 3 / Pro 6)', () => {
  for (const t of LAUNCH) assert.equal(TIER_CAPS[t].maxPages, MODEL.pages[t], `${t} pages`)
  assert.equal(TIER_CAPS.story_pack.periodAllowance, MODEL.allowance.story_pack)
  assert.equal(TIER_CAPS.story_pro.periodAllowance, MODEL.allowance.story_pro)
  assert.equal(TIER_CAPS.free.periodAllowance, null)
  assert.equal(TIER_CAPS.single.periodAllowance, null)
  assert.equal(FREE_GUEST_BOOKS, MODEL.freeGuest)
  assert.equal(FREE_LIFETIME_BOOKS, MODEL.freeLifetime)
  assert.match(read('lib/entitlements/policy.ts'), /No rollover at launch/)
})

test('2. the display catalogue mirrors the caps: prices, page counts, allowances; no yearly price; no print promise', () => {
  assert.deepEqual([...WIZARD_PLANS], [...LAUNCH])
  for (const t of LAUNCH) {
    const p = PLAN_CONFIG[t]
    assert.equal(p.priceMonthly, MODEL.price[t], `${t} price`)
    assert.equal(p.limits.maxPagesPerBook, TIER_CAPS[t].maxPages, `${t} page cap mirrors TIER_CAPS`)
    assert.equal(p.priceYearly, undefined, `${t} has no yearly price at launch`)
    assert.doesNotMatch(p.features.join('\n'), STALE_RE, `${t} features`)
  }
  assert.equal(PLAN_CONFIG.story_pack.limits.booksPerMonth, MODEL.allowance.story_pack)
  assert.equal(PLAN_CONFIG.story_pro.limits.booksPerMonth, MODEL.allowance.story_pro)
  assert.equal(PLAN_CONFIG.single.pricingType, 'one_time')
  assert.equal(PLAN_CONFIG.story_pack.pricingType, 'subscription')
  assert.equal(PLAN_CONFIG.story_pro.pricingType, 'subscription')
})

test('3. plan cards in both languages carry the right page counts and allowances and nothing stale', () => {
  for (const lang of LANGS) {
    const plans = dictionaries[lang].pricing.plans
    for (const t of LAUNCH) {
      const text = plans[t].features.join('\n')
      assert.match(text, new RegExp(`\\b${MODEL.pages[t]}\\b`), `${lang} ${t} names ${MODEL.pages[t]} pages`)
      assert.doesNotMatch(text, STALE_RE, `${lang} ${t} features`)
      // no other page count leaks into the card
      for (const n of Object.values(MODEL.pages)) if (n !== MODEL.pages[t]) assert.doesNotMatch(text, new RegExp(`\\b${n}\\b`), `${lang} ${t} must not mention ${n}`)
    }
    assert.match(plans.story_pack.features[0], /^3\b/, `${lang} Pack allowance 3`)
    assert.match(plans.story_pro.features[0], /^6\b/, `${lang} Pro allowance 6`)
    assert.match(plans.free.features[0], /^2\b/, `${lang} Free: two stories`)
    assert.match(plans.single.features[0], /^1\b/, `${lang} Single: one story`)
  }
})

test('4. Free allowance copy: one as a guest, two in total with an account (never three)', () => {
  for (const lang of LANGS) {
    const d = dictionaries[lang]
    const faq = d.pricing.faq.items[0].a
    assert.match(faq, /\b(two|dos)\b/i, `${lang} FAQ: two free stories`)
    assert.match(faq, /\b(One|Uno)\b/, `${lang} FAQ: one before an account`)
    assert.doesNotMatch(faq, /\b(three|tres)\b/i)
    assert.match(d.wizard.tryLine, /\b1\b.*\b2\b/, `${lang} wizard try line: 1 guest, 2 total`)
    assert.match(d.create.guestFor, /total/, `${lang} guest banner says "in total"`)
    assert.doesNotMatch(d.wizard.errors.guestLimitBody, /\b(two|dos|three|tres)\b/i, `${lang} guest-limit copy: one more, not two more`)
  }
  const create = read('app/(create)/create/page.tsx')
  assert.match(create, /getSetting\('guest_story_limit', 1\)/)
  assert.match(create, /getSetting\('free_user_story_limit', 2\)/)
})

test('5. no current customer surface (home, pricing, create, wizard, nav, emails) carries a stale or deferred claim', () => {
  for (const lang of LANGS) {
    const d = dictionaries[lang] as unknown as Record<string, unknown>
    const out: Array<[string, string]> = []
    for (const section of ['meta', 'nav', 'home', 'pricing', 'create', 'wizard', 'email', 'auth', 'account', 'notFound']) if (section in d) flatten(d[section], section, out)
    assert.ok(out.length > 200, `${lang} sections located`)
    for (const [path, v] of out) assert.doesNotMatch(v, STALE_RE, `${lang} ${path}`)
    const plan = (d.wizard as { plan: Record<string, unknown> }).plan
    assert.ok(!('educator' in plan) && !('educatorSoon' in plan), `${lang} wizard has no educator promotion keys`)
    assert.ok(!('comingLater' in d), `${lang} has no coming-later copy`)
    assert.ok(!('yearly' in (d.pricing as { card: Record<string, unknown> }).card), `${lang} has no yearly-savings card line`)
  }
  assert.doesNotMatch(read('components/story/wizard/steps/PlanStep.tsx'), /educator/i, 'plan step shows no educator line')
  assert.doesNotMatch(read('components/home/ModernHome.tsx'), STALE_RE, 'homepage copy')
  assert.doesNotMatch(read('app/pricing/page.tsx').replace(/\{flags\.classroom && \([\s\S]*?\n        \)\}/, ''), STALE_RE, 'pricing page outside the flag-gated classroom callout')
})

test('6. the chat widget learns pricing from the authoritative config and agrees with the launch model', () => {
  const k = launchPricingKnowledge()
  assert.match(read('app/api/chat/route.ts'), /launchPricingKnowledge\(\)/, 'route interpolates the shared knowledge')
  for (const t of LAUNCH) assert.match(k, new RegExp(`up to ${MODEL.pages[t]} pages`), `${t} pages`)
  assert.match(k, /\$7\.99 one-time/)
  assert.match(k, /\$9\.99\/month — 3 books per monthly billing period/)
  assert.match(k, /\$24\.99\/month — 6 books per monthly billing period/)
  assert.match(k, /1 Free book without an account/)
  assert.match(k, /2 Free books in total/)
  assert.match(k, /never 3/)
  assert.match(k, /monthly only/i)
  assert.match(k, /no annual or yearly plan/i)
  assert.match(k, /do not roll over/i)
  assert.match(k, /does not offer print ordering or priority processing/i)
  // The knowledge text legitimately NEGATES stale claims ("no annual", "does not
  // offer print ordering"), so only the stale numbers are forbidden here.
  const STALE_NUMBERS_RE = /10 stories|\/yr\b|\/year\b|\$99\b|\$249\b|\$599\b|save \d+%/i
  assert.doesNotMatch(k, STALE_NUMBERS_RE)
  const route = read('app/api/chat/route.ts')
  assert.doesNotMatch(route, STALE_NUMBERS_RE, 'route prompt text')
  assert.doesNotMatch(route, /free during beta|payments coming soon/i, 'no stale beta framing')
  assert.match(route, /Do not mention or promise educator plans, Classroom, Homeschool/)
})

test('7. drip email fallback copy derives its numbers from the config (no hard-coded 10 stories / one 8-page story / yearly price)', () => {
  const email = read('lib/services/email.ts')
  assert.doesNotMatch(email, STALE_RE)
  assert.doesNotMatch(email, /one 8-page story/)
  assert.match(email, /\$\{FREE_LIFETIME_BOOKS\} \$\{TIER_CAPS\.free\.maxPages\}-page stories/)
  assert.match(email, /\$\{TIER_CAPS\.story_pro\.periodAllowance\} stories\/month/)
  assert.match(email, /\$\{TIER_CAPS\.story_pack\.periodAllowance\} stories\/month/)
  assert.match(email, /\$\{PLAN_CONFIG\.story_pro\.priceMonthly\}\/mo/)
  // unsubscribe/suppression path untouched: drips still go through sendMarketingEmail
  assert.match(email, /return sendMarketingEmail\(\{ toEmail, subject, preheader, body \}\)/)
})

test('8. deferred product routes are a plain not-found for the public, and the legacy landing redirects home', () => {
  const gate = read('components/layout/ProductGate.tsx')
  assert.match(gate, /notFound\(\)/)
  assert.doesNotMatch(gate, /redirect\(/)
  assert.ok(!existsSync(resolve(ROOT, 'app/coming-later')))
  for (const dir of ['classroom', 'homeschool', 'learning', 'writer', 'publish']) assert.match(read(`app/${dir}/layout.tsx`), /<ProductGate area=/, `${dir} gated`)
  assert.match(read('app/storybooks/page.tsx'), /redirect\('\/'\)/, '/storybooks no longer renders stale claims')
})

test('9. sign-in is reachable from the shared header on every route (logged-out), never duplicated for signed-in users', () => {
  const controls = read('components/layout/UserControls.tsx')
  assert.match(controls, /if \(user === null\) \{[\s\S]*?href="\/login"[\s\S]*?t\.nav\.signIn/)
  assert.doesNotMatch(read('app/page.tsx'), /href="\/login"/, 'homepage relies on the shared header, no second link')
  assert.match(read('components/layout/SiteHeader.tsx'), /<UserControls \/>/)
})

test('10. age range: public copy matches the wizard child range (1–12)', () => {
  const child = read('components/story/wizard/steps/ChildStep.tsx')
  assert.match(child, /\{ label: '1–3'/); assert.match(child, /\{ label: '10–12'/)
  assert.match(read('components/story/wizard/cards.tsx'), /child:\s*\{ label: 'Child',\s*sub: 'Ages 1–12' \}/)
  for (const lang of LANGS) {
    const out: Array<[string, string]> = []
    flatten(dictionaries[lang], '', out)
    for (const [path, v] of out) assert.doesNotMatch(v, /ages? 2[–-]10|edades? 2[–-]10|any age|cualquier edad/i, `${lang} ${path}`)
  }
})
