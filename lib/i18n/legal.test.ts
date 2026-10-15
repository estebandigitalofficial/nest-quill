// Launch legal copy (2026-10-15 rewrite) — deterministic policy tests.
// Run: node --experimental-strip-types --test lib/i18n/legal.test.ts
//
// Pins the Terms of Service and Privacy Policy (EN + ES) to the launch
// product: locked operator wording, plan numbers from the single source of
// truth, the share-link and archive disclosures, and the absence of stale or
// undecided legal positions. Structural EN/ES parity is in i18n.test.ts.
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { legal, LEGAL_CONTACT, type LegalDoc } from './legal.ts'
import { PLAN_CONFIG } from '../plans/config.ts'
import { FREE_GUEST_BOOKS, FREE_LIFETIME_BOOKS, TIER_CAPS } from '../entitlements/policy.ts'
import { dictionaries } from './index.ts'

const LANGS = ['en', 'es'] as const
const DOCS = ['terms', 'privacy'] as const

function text(doc: LegalDoc): string {
  const parts = [doc.title, doc.updated, doc.operator]
  for (const s of doc.sections) {
    parts.push(s.title, s.betaBullet ?? '')
    for (const b of s.blocks) {
      if ('p' in b) parts.push(b.p)
      else if ('strong' in b) parts.push(b.strong)
      else if ('contact' in b) parts.push(b.contact)
      else parts.push(...b.ul)
    }
  }
  return parts.join('\n')
}

const all = (lang: 'en' | 'es') => text(legal[lang].terms) + '\n' + text(legal[lang].privacy)

test('1. Operator wording is exactly the locked sentence, with no entity designation', () => {
  for (const doc of DOCS) {
    assert.equal(legal.en[doc].operator, 'Nest & Quill is operated by Digital Official & Huerta Group.')
    assert.equal(legal.es[doc].operator, 'Nest & Quill es operado por Digital Official & Huerta Group.')
  }
  for (const lang of LANGS) {
    assert.doesNotMatch(all(lang), /Bright Tale|\bLLC\b|\bInc\b|\bCorp|\bDBA\b|S\.A\. de C\.V\./, lang)
  }
  assert.equal(LEGAL_CONTACT, 'contact@nestandquill.com')
})

test('2. Last-updated date is the revision date and identical across languages and documents', () => {
  for (const doc of DOCS) {
    assert.equal(legal.en[doc].updated, 'Last updated: October 15, 2026')
    assert.equal(legal.es[doc].updated, 'Última actualización: 15 de octubre de 2026')
  }
  for (const lang of LANGS) assert.doesNotMatch(all(lang), /May 2026|mayo de 2026/)
})

test('3. Plan prices, pages and allowances match TIER_CAPS / PLAN_CONFIG in both languages', () => {
  const price = (n: number) => `$${n.toFixed(2)}`
  for (const lang of LANGS) {
    const terms = text(legal[lang].terms)
    assert.ok(terms.includes(price(PLAN_CONFIG.single.priceMonthly)), `${lang} single price`)
    assert.ok(terms.includes(price(PLAN_CONFIG.story_pack.priceMonthly)), `${lang} pack price`)
    assert.ok(terms.includes(price(PLAN_CONFIG.story_pro.priceMonthly)), `${lang} pro price`)
    for (const tier of ['free', 'single', 'story_pack', 'story_pro'] as const) {
      assert.ok(terms.includes(`${TIER_CAPS[tier].maxPages}`), `${lang} ${tier} pages`)
    }
    const pack = lang === 'en' ? `up to ${TIER_CAPS.story_pack.periodAllowance} books` : `hasta ${TIER_CAPS.story_pack.periodAllowance} libros`
    const pro = lang === 'en' ? `up to ${TIER_CAPS.story_pro.periodAllowance} books` : `hasta ${TIER_CAPS.story_pro.periodAllowance} libros`
    assert.ok(terms.includes(pack) && terms.includes(pro), `${lang} allowances`)
    const free = lang === 'en'
      ? [`can create ${FREE_GUEST_BOOKS} Free book`, `total Free allowance of ${FREE_LIFETIME_BOOKS} books`]
      : [`puede crear ${FREE_GUEST_BOOKS} libro Free`, `límite total de ${FREE_LIFETIME_BOOKS} libros Free`]
    for (const f of free) assert.ok(terms.includes(f), `${lang}: ${f}`)
    // Every dollar amount in the documents is a launch price.
    const allowed = new Set([7.99, 9.99, 24.99].map(price))
    for (const m of all(lang).match(/\$\d+(\.\d+)?/g) ?? []) assert.ok(allowed.has(m), `${lang} unexpected price ${m}`)
  }
})

test('4. Stale products, billing and undecided legal positions are gone', () => {
  const stale = [
    /annual(?! billing)|yearly|\banual(?!\.)/i, /arbitrat|arbitraje/i, /governing law|governed by the laws|se rigen? por las leyes/i, /\bvenue\b/i,
    /class action|demanda colectiva/i, /30 days|30 días/i, /Request account deletion|Solicitar la eliminación de tu cuenta/i,
    /DALL|gpt-|gpt_image/i, /sponsor|patrocinador/i, /Bright Tale University/i, /Writer Studio/i, /quiz|flashcard|cuestionario/i,
    /COPPA|GDPR|CCPA|legitimate interest|interés legítimo|verifiable|certif/i, /print ordering|priority (processing|queue)(?!\.)/i,
    /basic analytics|analítica básica/i, /train external AI|entrenar modelos de IA externos/i,
  ]
  for (const lang of LANGS) {
    for (const re of stale) assert.doesNotMatch(all(lang), re, `${lang}: ${re}`)
  }
  // "annual" survives only as the explicit negation.
  assert.match(text(legal.en.terms), /There is no annual billing\./)
  assert.match(text(legal.es.terms), /No hay facturación anual\./)
  // Printed books and priority processing appear only as an explicit negation.
  assert.match(text(legal.en.terms), /We do not offer printed books or priority processing\./)
  assert.match(text(legal.es.terms), /No ofrecemos libros impresos ni procesamiento prioritario\./)
})

test('4b. Eligibility is adults age 18 or older, consistent in EN/ES Terms and Privacy', () => {
  assert.match(text(legal.en.terms), /You must be an adult age 18 or older to create an account, submit a story, or buy a plan\./)
  assert.match(text(legal.es.terms), /Debes ser una persona adulta de 18 años o más para crear una cuenta, enviar un cuento o comprar un plan\./)
  assert.match(text(legal.en.privacy), /intended for adults age 18 or older/)
  assert.match(text(legal.es.privacy), /personas adultas de 18 años o más/)
})

test('5. Share-link, archive and deletion disclosures describe current behaviour', () => {
  const en = all('en'), es = all('es')
  assert.match(en, /Anyone who has the link can (open and )?read the finished story without signing in/)
  assert.match(es, /Cualquier persona que tenga el enlace puede (abrir y )?leer el cuento terminado sin iniciar sesión/)
  assert.match(en, /Archiving is not deletion/)
  assert.match(es, /Archivar no es eliminar/)
  assert.match(en, /Archiving a story does not turn off its link/)
  assert.match(es, /Archivar un cuento no desactiva su enlace/)
  assert.match(en, /no self-service way to permanently delete a story or an account/)
  assert.match(es, /no existe una forma de eliminar de manera permanente un cuento o una cuenta/)
  assert.match(en, /We have not set fixed retention periods/)
  assert.match(es, /No hemos fijado plazos de conservación/)
})

test('6. Same license for Free and paid books; no IP transfer', () => {
  assert.match(text(legal.en.terms), /whether on the Free plan or a paid plan, comes with the same license: a personal, non-exclusive/)
  assert.match(text(legal.es.terms), /ya sea con el plan Free o con un plan de pago, incluye la misma licencia: una licencia personal, no exclusiva/)
  assert.match(text(legal.en.terms), /does not transfer ownership/)
  assert.match(text(legal.es.terms), /no transfiere la propiedad/)
})

test('7. Privacy discloses providers, no raw IP/geo on stories, and marketing vs service email', () => {
  for (const lang of LANGS) {
    const p = text(legal[lang].privacy)
    for (const v of ['Vercel', 'Supabase', 'OpenAI', 'Resend', 'Bunny CDN', 'Cloudflare', 'Gmail', 'Stripe']) assert.ok(p.includes(v), `${lang} ${v}`)
    for (const k of ['guest_token', 'nq_lang', 'cookie_consent']) assert.ok(p.includes(k), `${lang} ${k}`)
  }
  assert.match(text(legal.en.privacy), /We do not store your IP address, or a location derived from it, with your story records/)
  assert.match(text(legal.es.privacy), /No guardamos tu dirección IP, ni una ubicación derivada de ella, en los registros de tus cuentos/)
  assert.match(text(legal.en.privacy), /Unsubscribing from marketing does not stop service emails/)
  assert.match(text(legal.es.privacy), /Darte de baja del marketing no detiene los correos del servicio/)
})

test('8. EN and ES carry the same numbers and the same section titles are unique per document', () => {
  for (const doc of DOCS) {
    const nums = (lang: 'en' | 'es') => (text(legal[lang][doc]).match(/\d+(\.\d+)?/g) ?? []).filter(n => n !== '15' && n !== '2026').sort()
    assert.deepEqual(nums('es'), nums('en'), doc)
    for (const lang of LANGS) {
      const titles = legal[lang][doc].sections.map(s => s.title)
      assert.equal(new Set(titles).size, titles.length, `${lang} ${doc} titles unique (React keys)`)
    }
  }
})

test('9. Surrounding launch copy: email From name, contact categories, cookie banner wording', () => {
  const read = (rel: string) => readFileSync(resolve(import.meta.dirname, '../..', rel), 'utf8')
  for (const f of ['lib/services/email.ts', 'lib/services/adminNotifications.ts']) {
    const src = read(f)
    assert.match(src, /const FROM = 'Nest & Quill <stories@nestandquill\.com>'/, f)
    assert.doesNotMatch(src, /Bright Tale|\bLLC\b|\bInc\b/, f)
  }
  const api = read('app/api/contact/route.ts')
  const form = read('app/contact/ContactForm.tsx')
  for (const slug of ['classroom_educator', 'sponsor_rewards']) {
    assert.doesNotMatch(api.split('// Per-stage')[0].replace(/^\/\/.*$/gm, ''), new RegExp(`'${slug}'`), `API still accepts ${slug}`)
    assert.doesNotMatch(form.replace(/^\/\/.*$/gm, ''), new RegExp(slug), `form offers ${slug}`)
  }
  for (const lang of LANGS) {
    assert.doesNotMatch(Object.keys(dictionaries[lang].contact.categories).join(' '), /classroom|sponsor/)
    assert.match(dictionaries[lang].cookie.text, lang === 'en' ? /cookies and browser storage/ : /cookies y el almacenamiento del navegador/)
  }
})
