import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { dictionaries, resolveLang, getDictionary, fill, navLabel, errorMessage, plural, htmlLang, LANG_COOKIE, DEFAULT_LANG } from './index.ts'
import { legal } from './legal.ts'
import { authErrorMessage } from './authErrors.ts'

type Node = string | number | boolean | Node[] | { [k: string]: Node }

function walk(node: Node, path: string, visit: (path: string, value: string) => void) {
  if (typeof node === 'string') return visit(path, node)
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`, visit))
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v as Node, path ? `${path}.${k}` : k, visit)
}

function keys(node: Node, path = ''): string[] {
  const out: string[] = []
  walk(node, path, p => out.push(p))
  return out.sort()
}

function listFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) listFiles(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

test('1. English is the default language and the cookie name is stable', () => {
  assert.equal(DEFAULT_LANG, 'en')
  assert.equal(LANG_COOKIE, 'nq_lang')
  assert.equal(resolveLang(undefined), 'en')
  assert.equal(resolveLang(''), 'en')
  assert.equal(resolveLang('fr'), 'en')
  assert.equal(resolveLang('es'), 'es')
  assert.equal(htmlLang('es'), 'es')
  assert.equal(htmlLang('en'), 'en')
})

test('2. Spanish selection persists: provider writes the cookie, the server reads it, the layout sets <html lang>', () => {
  const ctx = readFileSync('lib/i18n/context.tsx', 'utf8')
  assert.match(ctx, /document\.cookie = `\$\{LANG_COOKIE\}=\$\{next\};path=\/;max-age=/)
  assert.match(ctx, /router\.refresh\(\)/)
  assert.match(ctx, /document\.documentElement\.lang = htmlLang\(next\)/)
  const server = readFileSync('lib/i18n/server.ts', 'utf8')
  assert.match(server, /store\.get\(LANG_COOKIE\)/)
  const layout = readFileSync('app/layout.tsx', 'utf8')
  assert.match(layout, /<html lang=\{htmlLang\(lang\)\}/)
  assert.match(layout, /<LanguageProvider initialLang=\{lang\}>/)
})

test('3. CURRENT navigation translates (header, mobile menu, footer, tab bar)', () => {
  for (const href of ['/create', '/pricing', '/contact', '/privacy', '/terms']) {
    const en = navLabel('en', href, 'x'), es = navLabel('es', href, 'x')
    assert.notEqual(en, 'x'); assert.notEqual(es, 'x'); assert.notEqual(en, es, href)
  }
  assert.equal(navLabel('es', '/unknown', 'Fallback'), 'Fallback')
  assert.equal(dictionaries.es.nav.tabs.create, 'Crear')
  assert.equal(dictionaries.es.nav.tabs.account, 'Cuenta')
  for (const f of ['components/layout/SiteHeader.tsx', 'components/layout/MobileMenu.tsx', 'components/layout/SiteFooter.tsx']) {
    assert.match(readFileSync(f, 'utf8'), /navLabel\(lang, /, f)
  }
  assert.match(readFileSync('components/layout/MobileTabBar.tsx', 'utf8'), /t\.nav\.tabs\.(home|create|account)/)
})

test('4. Pricing translates without changing prices or plan semantics', () => {
  const cfg = readFileSync('lib/plans/config.ts', 'utf8')
  assert.match(cfg, /priceMonthly: 7\.99/); assert.match(cfg, /priceMonthly: 9\.99/); assert.match(cfg, /priceMonthly: 24\.99/)
  for (const lang of ['en', 'es'] as const) {
    const plans = dictionaries[lang].pricing.plans
    for (const tier of ['free', 'single', 'story_pack', 'story_pro'] as const) {
      assert.ok(plans[tier].name.length > 0)
      assert.ok(plans[tier].features.length >= 5)
      for (const f of plans[tier].features) assert.doesNotMatch(f, /\$\d/, 'features never carry a price')
    }
    assert.match(plans.single.features.join(' '), /16/)
    assert.match(plans.story_pack.features.join(' '), /3 /)
    assert.match(plans.story_pro.features.join(' '), /6 /)
    assert.doesNotMatch(plans.story_pro.features.join(' '), /[Pp]riority|[Pp]rioridad/)
  }
  const card = readFileSync('components/pricing/PlanCard.tsx', 'utf8')
  assert.match(card, /plan\.priceMonthly/)
  assert.doesNotMatch(card, /t\.pricing\.plans\[tier\]\.price/)
})

test('5. Create / wizard translates: every step reads the dictionary and no English literals remain in field chrome', () => {
  const files = [
    'components/story/wizard/StoryWizard.tsx', 'components/story/wizard/WizardProgress.tsx',
    'components/story/wizard/steps/PlanStep.tsx', 'components/story/wizard/steps/ChildStep.tsx',
    'components/story/wizard/steps/StoryStep.tsx', 'components/story/wizard/steps/StyleStep.tsx',
    'components/story/wizard/steps/ReviewStep.tsx', 'components/story/wizard/cards.tsx',
  ]
  for (const f of files) assert.match(readFileSync(f, 'utf8'), /useLanguage\(\)/, f)
  const style = readFileSync('components/story/wizard/steps/StyleStep.tsx', 'utf8')
  assert.doesNotMatch(style, /placeholder="e\.g\./)
  assert.doesNotMatch(style, />\s*Upgrade\s*</)
  const child = readFileSync('components/story/wizard/steps/ChildStep.tsx', 'utf8')
  assert.doesNotMatch(child, /label="Supporting characters"/)
  // Spanish wizard copy exists for every card label
  const es = dictionaries.es.wizard.cards
  assert.equal(Object.keys(es.traits).length, 20)
  assert.equal(Object.keys(es.settings).length, 6)
  assert.equal(Object.keys(es.conflicts).length, 12)
  assert.equal(Object.keys(es.goals).length, 10)
  assert.equal(Object.keys(es.styles).length, 5)
})

test('6/7. The site language is the story language: Spanish site → Spanish book, English site → English book', () => {
  const wizard = readFileSync('components/story/wizard/StoryWizard.tsx', 'utf8')
  assert.match(wizard, /body: JSON\.stringify\(\{ \.\.\.data, language: lang \}\)/)
  const submit = readFileSync('app/api/story/submit/route.ts', 'utf8')
  assert.match(submit, /const language: 'en' \| 'es' = body\.language === 'es' \? 'es' : 'en'/)
  assert.match(submit, /locale: language,/)
  assert.match(submit, /triggerProcessingPipeline\(requestId, language\)/)
  // Recovery paths carry the persisted language, and the worker falls back to it.
  assert.match(readFileSync('app/api/story/[requestId]/retry/route.ts', 'utf8'), /language: .*locale === 'es'/)
  assert.match(readFileSync('app/api/story/[requestId]/force-requeue/route.ts', 'utf8'), /language: .*locale === 'es'/)
  const engine = readFileSync('supabase/functions/process-story/index.ts', 'utf8')
  assert.match(engine, /if \(!languageFromBody\) \{\s*language = \(storyRequest as \{ locale\?: string \| null \}\)\.locale === 'es' \? 'es' : 'en'/)
  assert.match(readFileSync('supabase/functions/process-story/prompt.ts', 'utf8'), /LANGUAGE REQUIREMENT: You MUST write the entire story/)
})

test('8. Entitlement rules are unchanged by localization', () => {
  const submit = readFileSync('app/api/story/submit/route.ts', 'utf8')
  assert.match(submit, /reserveEntitlement\(supabaseEntitlementStore\(\)/)
  assert.doesNotMatch(submit, /betaMode|beta_mode_enabled/)
  const policy = readFileSync('lib/entitlements/policy.ts', 'utf8')
  assert.match(policy, /free:\s+\{ maxPages: 8,/); assert.match(policy, /single:\s+\{ maxPages: 16,/)
  assert.match(policy, /story_pack: \{ maxPages: 24,[^}]*periodAllowance: 3/); assert.match(policy, /story_pro:\s+\{ maxPages: 32,[^}]*periodAllowance: 6/)
  assert.doesNotMatch(policy, /lang|i18n/)
})

test('9. Hidden products remain hidden in both languages', () => {
  // Nav labels exist only for launch routes; nothing in the dictionaries
  // links to classroom / learning / homeschool / writer / publish.
  for (const lang of ['en', 'es'] as const) {
    const links = Object.keys(dictionaries[lang].nav.links)
    assert.deepEqual(links.sort(), ['/', '/contact', '/create', '/pricing', '/privacy', '/terms'])
    let hrefs = ''
    walk(dictionaries[lang] as unknown as Node, '', (_p, v) => { hrefs += v + '\n' })
    assert.doesNotMatch(hrefs, /\/(classroom|learning|homeschool|writer|publish)\b/)
  }
  // The gated scope module is untouched.
  const scope = readFileSync('lib/launch/scope.ts', 'utf8')
  assert.match(scope, /classroom: false,\s*homeschool: false,\s*learningTools: false,\s*writerStudio: false,\s*publishing: false/)
})

test('10. No customer theme / color toggle remains', () => {
  assert.equal(existsSync('components/FloatingToggles.tsx'), false)
  assert.equal(existsSync('components/ThemeToggle.tsx'), false)
  assert.equal(existsSync('components/LanguageToggle.tsx'), false)
  const layout = readFileSync('app/layout.tsx', 'utf8')
  assert.doesNotMatch(layout, /FloatingToggles|ThemeToggle/)
  // useTheme / cycleTheme only remain in admin-only files.
  const offenders: string[] = []
  for (const f of [...listFiles('app'), ...listFiles('components')]) {
    if (f.includes('/admin')) continue
    if (f.endsWith('components/ThemeProvider.tsx') || f.endsWith('components/ThemeToggles.tsx')) continue
    const src = readFileSync(f, 'utf8')
    if (/cycleTheme|useToggles|from 'next-themes'/.test(src)) offenders.push(f)
  }
  assert.deepEqual(offenders, [])
  assert.match(readFileSync('components/LanguageSwitcher.tsx', 'utf8'), /aria-pressed/)
  assert.doesNotMatch(readFileSync('components/LanguageSwitcher.tsx', 'utf8'), /useTheme|cycleTheme|setTheme/)
})

test('11. Mobile navigation works in both languages (labels present, panel offset matches the header)', () => {
  for (const lang of ['en', 'es'] as const) {
    const d = dictionaries[lang]
    for (const v of Object.values(d.nav.tabs)) assert.ok(v.length > 0 && v.length <= 10, `${lang} tab label "${v}" fits the bar`)
    assert.ok(d.nav.menuOpen.length > 0 && d.nav.menuClose.length > 0)
  }
  const menu = readFileSync('components/layout/MobileMenu.tsx', 'utf8')
  assert.match(menu, /top-\[58px\]/)
  assert.match(readFileSync('components/layout/SiteHeader.tsx', 'utf8'), /h-\[58px\] md:h-\[60px\]/)
  assert.match(readFileSync('components/layout/SiteHeader.tsx', 'utf8'), /<LanguageSwitcher/)
})

test('12. No translation key is ever rendered: Spanish mirrors every English key with real text', () => {
  const enKeys = keys(dictionaries.en as unknown as Node)
  const esKeys = keys(dictionaries.es as unknown as Node)
  assert.deepEqual(esKeys, enKeys)
  for (const lang of ['en', 'es'] as const) {
    walk(dictionaries[lang] as unknown as Node, '', (path, value) => {
      assert.ok(value.trim().length > 0, `${lang} ${path} is empty`)
      assert.doesNotMatch(value, /^[a-z]+(\.[a-zA-Z]+)+$/, `${lang} ${path} looks like a raw key: ${value}`)
    })
  }
  // Every placeholder used in English exists in Spanish too.
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
  const esMap = new Map<string, string>()
  walk(dictionaries.es as unknown as Node, '', (p, v) => esMap.set(p, v))
  walk(dictionaries.en as unknown as Node, '', (p, v) => { if (/\{\w+\}/.test(v)) assert.equal(ph(esMap.get(p) ?? ''), ph(v), `placeholders differ at ${p}`) })
  // Helpers never throw and never leak keys.
  assert.equal(fill('Hello {name}', { name: 'Ana' }), 'Hello Ana')
  assert.equal(fill('Hello {missing}', {}), 'Hello {missing}')
  assert.equal(errorMessage('es', 'ACCOUNT_REQUIRED'), dictionaries.es.wizard.errors.codes.ACCOUNT_REQUIRED)
  assert.equal(errorMessage('es', 'NOPE', 'raw english'), dictionaries.es.wizard.errors.generic)
  assert.equal(errorMessage('en', 'NOPE', 'raw english'), 'raw english')
  assert.equal(plural('es', dictionaries.es.create.stories, 1), '1 cuento')
  assert.equal(plural('es', dictionaries.es.create.stories, 2), '2 cuentos')
  assert.equal(authErrorMessage(getDictionary('es'), 'Invalid login credentials'), dictionaries.es.auth.errors.invalidCredentials)
  assert.equal(authErrorMessage(getDictionary('es'), 'weird provider text'), dictionaries.es.auth.errors.generic)
  // Legal: same section count, same beta flags, same structure in both languages.
  for (const doc of ['terms', 'privacy'] as const) {
    const en = legal.en[doc], es = legal.es[doc]
    assert.equal(es.sections.length, en.sections.length, doc)
    en.sections.forEach((sec, i) => {
      assert.equal(!!es.sections[i].beta, !!sec.beta, `${doc} beta flag ${i}`)
      assert.equal(es.sections[i].blocks.length, sec.blocks.length, `${doc} blocks ${i}`)
      assert.equal(!!es.sections[i].betaBullet, !!sec.betaBullet, `${doc} betaBullet ${i}`)
    })
  }
})

test('13. Admin is not localized (admin files never import the customer dictionary or language context)', () => {
  const offenders: string[] = []
  for (const f of [...listFiles('app/admin'), ...listFiles('components/admin'), ...listFiles('app/api/admin')]) {
    const src = readFileSync(f, 'utf8')
    if (/from '@\/lib\/i18n(\/|')/.test(src) && !f.endsWith('AdminHeaderToggles.tsx')) offenders.push(f)
  }
  assert.deepEqual(offenders, [])
  assert.doesNotMatch(readFileSync('lib/admin/nav.ts', 'utf8'), /i18n/)
})

test('14. Transactional emails follow the customer language and the legal copy is faithful', () => {
  const email = readFileSync('lib/services/email.ts', 'utf8')
  assert.match(email, /<html lang="\$\{lang\}">/)
  assert.doesNotMatch(email, /<html lang="en">/)
  assert.match(email, /sendSubmissionConfirmationEmail\(\s*toEmail: string,\s*childName: string,\s*requestId: string,\s*langInput/)
  assert.match(email, /sendWelcomeEmail\(toEmail: string, langInput/)
  assert.match(readFileSync('app/api/story/submit/route.ts', 'utf8'), /sendSubmissionConfirmationEmail\(formData\.userEmail, formData\.childName, requestId, language\)/)
  for (const f of ['app/api/internal/story-completed/route.ts', 'app/api/story/status/route.ts', 'app/api/admin/stories/[requestId]/resend-email/route.ts']) {
    assert.match(readFileSync(f, 'utf8'), /lang: .*locale === 'es' \? 'es' : 'en'/, f)
  }
  assert.match(readFileSync('app/auth/callback/route.ts', 'utf8'), /sendWelcomeEmail\(user\.email, cookieStore\.get\('nq_lang'\)/)
  // Same substantive rules: the refund and cancellation bullets exist in both languages.
  const enPay = legal.en.terms.sections.find(s => s.title === 'Payments and Refunds')!
  const esPay = legal.es.terms.sections.find(s => s.title === 'Pagos y reembolsos')!
  assert.equal((esPay.blocks[0] as { ul: string[] }).ul.length, (enPay.blocks[0] as { ul: string[] }).ul.length)
})
