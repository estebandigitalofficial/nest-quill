// Launch legal copy (2026-10-15 rewrite) — deterministic policy tests.
// Run: node --experimental-strip-types --test lib/i18n/legal.test.ts
//
// Pins the Terms of Service and Privacy Policy (EN + ES) to the launch
// product: locked operator wording, plan numbers from the single source of
// truth, the share-link and archive disclosures, and the absence of stale or
// undecided legal positions. Structural EN/ES parity is in i18n.test.ts.
// Test 10 (3C-8, 2026-10-16) pins the customer permanent-deletion disclosure
// to the capability app/api/story/[requestId] DELETE actually provides.
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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
    assert.equal(legal.en[doc].updated, 'Last updated: October 16, 2026')
    assert.equal(legal.es[doc].updated, 'Última actualización: 16 de octubre de 2026')
  }
  for (const lang of LANGS) assert.doesNotMatch(all(lang), /May 2026|mayo de 2026|October 15|15 de octubre/)
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
  // 3C-8: the "no self-service deletion" statement is gone (it became false with 3C-3); test 10 pins its replacement.
  assert.doesNotMatch(en, /no self-service way|There is currently no self-service/)
  assert.doesNotMatch(es, /no existe una forma de eliminar de manera permanente|por tu cuenta\. Para pedirnos/)
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
    const nums = (lang: 'en' | 'es') => (text(legal[lang][doc]).match(/\d+(\.\d+)?/g) ?? []).filter(n => n !== '16' && n !== '2026').sort()
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

// ── 3C-8: customer permanent deletion of archived failed stories ──────────
const ROOT = resolve(import.meta.dirname, '../..')
const sha = (rel: string) => createHash('sha256').update(readFileSync(resolve(ROOT, rel))).digest('hex')
const DELETION_SECTION = { en: 'Archive, Deletion and Deletion Requests', es: 'Archivo, eliminación y solicitudes de eliminación' } as const

test('10. Deletion disclosure matches the 3C-3 capability in EN and ES Terms and Privacy', () => {
  const docs = { en: { terms: text(legal.en.terms), privacy: text(legal.en.privacy) }, es: { terms: text(legal.es.terms), privacy: text(legal.es.privacy) } }
  // (2)-(5) each document describes the narrow capability: own + failed + archived + system confirms it is safe.
  for (const doc of DOCS) {
    assert.match(docs.en[doc], /permanently delete a story yourself only when it belongs to your account, its generation failed, you have archived it, and the Service confirms that it is not being worked on and is safe to remove/, `en ${doc}`)
    assert.match(docs.es[doc], /eliminar de manera permanente un cuento por tu cuenta solo cuando pertenece a tu cuenta, su generación falló, lo has archivado y el Servicio confirma que no se está trabajando en él y que es seguro eliminarlo/, `es ${doc}`)
    // (6) archive is explicitly distinguished from permanent deletion, and archive keeps data + link + restore.
    assert.match(docs.en[doc], /Permanent deletion is a separate action/, `en ${doc}`)
    assert.match(docs.es[doc], /La eliminación permanente es una acción distinta/, `es ${doc}`)
    // (7)(8)(9) no completed-story, account or guest self-service deletion.
    assert.match(docs.en[doc], /Finished stories, stories still in progress, guest stories and accounts cannot be deleted this way at this time/, `en ${doc}`)
    assert.match(docs.es[doc], /Los cuentos terminados, los cuentos en curso, los cuentos de invitado y las cuentas no pueden eliminarse de esta forma por ahora/, `es ${doc}`)
    // (11) asynchronous clean-up with automatic retry; (10) no fixed completion time.
    assert.match(docs.en[doc], /Part of this clean-up may finish after your request has been accepted/, `en ${doc}`)
    assert.match(docs.en[doc], /retries it automatically/, `en ${doc}`)
    assert.match(docs.en[doc], /We do not promise a fixed completion time/, `en ${doc}`)
    assert.match(docs.es[doc], /Parte de esta limpieza puede terminar después de que tu solicitud haya sido aceptada/, `es ${doc}`)
    assert.match(docs.es[doc], /la reintenta automáticamente/, `es ${doc}`)
    assert.match(docs.es[doc], /No prometemos un plazo fijo para completarla/, `es ${doc}`)
  }
  assert.match(docs.en.terms, /Archiving is not deletion/)
  assert.match(docs.es.terms, /Archivar no es eliminar/)
  assert.match(docs.en.privacy, /It is not deletion/)
  assert.match(docs.es.privacy, /No es eliminarlo/)
  // (6) deletion is not account closure.
  assert.match(docs.en.terms, /Deleting a story does not close your account/)
  assert.match(docs.es.terms, /Eliminar un cuento no cierra tu cuenta/)
  assert.match(docs.en.privacy, /Deleting a story is not account deletion and does not remove other information/)
  assert.match(docs.es.privacy, /Eliminar un cuento no es eliminar la cuenta y no retira otra información/)
  // (12) minimal deletion record kept, listed under Data Retention in both languages.
  assert.match(docs.en.privacy, /A minimal record of each permanent story deletion \(which account deleted which story, when, and whether the clean-up finished\), for security, integrity, operational and accountability purposes/)
  assert.match(docs.es.privacy, /Un registro mínimo de cada eliminación permanente de un cuento \(qué cuenta eliminó qué cuento, cuándo y si la limpieza terminó\), con fines de seguridad, integridad, operación y rendición de cuentas/)
  assert.match(docs.en.privacy, /We keep a minimal record of the deletion/)
  assert.match(docs.es.privacy, /Conservamos un registro mínimo de la eliminación/)
  // (13) purchase / subscription records remain with the story detached.
  assert.match(docs.en.terms, /Records of purchases and subscription periods are kept, with the deleted story no longer attached to them/)
  assert.match(docs.es.terms, /Los registros de compras y periodos de suscripción se conservan, y el cuento eliminado deja de estar vinculado a ellos/)
  assert.match(docs.en.privacy, /Purchase and subscription records are kept for the reasons listed there, with the deleted story no longer attached to them/)
  assert.match(docs.es.privacy, /Los registros de compras y suscripciones se conservan por los motivos indicados allí, y el cuento eliminado deja de estar vinculado a ellos/)
  // (14) paid units are not restored and deletion is not a refund; Free allowance only "may" return.
  assert.match(docs.en.terms, /does not restore a book used from a purchase or subscription period and is not a refund/)
  assert.match(docs.es.terms, /no restituye un libro usado de una compra o de un periodo de suscripción y no constituye un reembolso/)
  assert.match(docs.en.terms, /that Free book may become available again under the Free plan rules/)
  assert.match(docs.es.terms, /ese libro Free puede volver a estar disponible según las reglas del plan Free/)
  for (const lang of LANGS) {
    const t = all(lang)
    // Automatic restoration or refund appears only under a negation ("is not automatically restored", "no se restituye automáticamente").
    assert.doesNotMatch(t, /(?<!not )(?<!no )(?<!no se )\b(automatically (restored|refunded|replaced)|se (restituyen?|reembolsan?|reemplazan?) automáticamente)|replacement credit|crédito de reemplazo/i, `${lang} promises automatic restoration`)
    // (10) no fixed deletion timeline anywhere: no "within N days/hours", no "immediately deleted".
    assert.doesNotMatch(t, /within \d+ (days?|hours?|business days?)|en (un plazo de )?\d+ (días|horas)|deleted immediately|se elimina de inmediato|instantly|al instante/i, `${lang} fixed deletion timeline`)
    assert.doesNotMatch(t, /(delete|remove|elimina|retira)[a-z]* (all|every|toda|todos) (your|tu|tus) (data|information|datos|información)/i, `${lang} promises deletion of all data`)
    // (16) no implementation internals in customer-facing copy.
    assert.doesNotMatch(t, /deletion_log|delete_failed_story|complete_story_deletion|\bRPC\b|story-images|book-exports|service[ _-]role|cron|reconcil|cascade|worker_id|customer_story_deletion_enabled|app_settings|Supabase Storage bucket/i, `${lang} leaks implementation detail`)
  }
  // Privacy "Your choices" lists the capability, scoped to eligible archived failed stories, in both languages.
  assert.match(docs.en.privacy, /Permanently delete a story that belongs to you when it is archived, has failed and is eligible/)
  assert.match(docs.es.privacy, /Eliminar de manera permanente un cuento que te pertenece cuando está archivado, falló y es elegible/)
  // Section titles renamed in step in both languages; the deletion disclosure is one four-block section in each Privacy Policy.
  for (const lang of LANGS) {
    const sec = legal[lang].privacy.sections.find(s => s.title === DELETION_SECTION[lang])
    assert.ok(sec, `${lang} deletion section`)
    assert.equal(sec!.blocks.length, 4)
    const terms = legal[lang].terms.sections.find(s => s.title === (lang === 'en' ? 'Archive and Deletion' : 'Archivo y eliminación'))
    assert.equal(terms!.blocks.length, 4)
  }
  // (1)(15) the operator line is untouched by this update.
  for (const doc of DOCS) assert.equal(legal.en[doc].operator, 'Nest & Quill is operated by Digital Official & Huerta Group.')
})

test('11. 3C-8 changed only the legal copy: the flag stays unseeded and the 3C-3 route/service, 3C-6 sweep and migrations are untouched', () => {
  // (17) no app_settings row, migration, seed or admin toggle enables customer_story_deletion_enabled.
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
      const p = resolve(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(ts|tsx|sql|json|mjs)$/.test(name)) out.push(p)
    }
    return out
  }
  const files = ['app', 'components', 'lib', 'supabase'].flatMap(d => walk(resolve(ROOT, d)))
  const refs = files.filter(f => !f.endsWith('.test.ts') && readFileSync(f, 'utf8').includes('customer_story_deletion_enabled'))
  // (paths are joined so this test file never contains the literal deletion-module path the importer pins look for)
  const DELETION_DIR = ['lib', 'deletion'].join('/')
  // 3C-4 added the archived page as the one display switch (server read, fallback false).
  assert.deepEqual(refs.sort(), [resolve(ROOT, 'app/api/story/[requestId]/route.ts'), resolve(ROOT, DELETION_DIR, 'customerDeleteRoute.ts'), resolve(ROOT, 'app/account/archived/page.tsx')].sort(), `flag referenced by ${refs.join(', ')}`)
  for (const f of files.filter(f => /supabase\/migrations\/.*\.sql$/.test(f))) assert.doesNotMatch(readFileSync(f, 'utf8'), /customer_story_deletion_enabled/, f)
  for (const f of files.filter(f => /app\/admin\//.test(f))) assert.doesNotMatch(readFileSync(f, 'utf8'), /customer_story_deletion/, `${f} exposes the flag in admin UI`)
  // (18) 3C-3 route and service, (19) 3C-6 sweep and cron config, (20) migrations: content pinned at PR #35 head 616d5cf.
  const pinned: Record<string, string> = {
    'app/api/story/[requestId]/route.ts': '2c546febba4d839b3d5919bb44c9f970848befa967813a01c5cb0408c3ffee39',
    'app/api/story/[requestId]/restore/route.ts': '59fe0d859b765326e2d97ce68f89194eb22cfbba5fd1a97a8d359fd5d194a7d5',
    'app/api/story/[requestId]/retry/route.ts': '88f66560100296e2ac732545dca6f73c7ade4dbf72036b39275586d6bf65bfa9',
    [`${DELETION_DIR}/customerDeleteRoute.ts`]: '602cb11306e04d1480775b7b0649a2bfbd5ef77c056a9b429dcdcb52cf4217e8',
    [`${DELETION_DIR}/deleteFailedStory.ts`]: '19ae7d1812ca87c7e3436f9fb878483932a705fe747b908244d371e9be7da8ad',
    [`${DELETION_DIR}/storagePaths.ts`]: '5c7d29e3c82722d6e4510cc13772acaca8e90d0bc80ef885167304c1a9bbff0a',
    [`${DELETION_DIR}/decision.ts`]: 'fca73cff902e958ce6db1943c3db2289c281e99f9f3f234708b2199f111a0f3a',
    [`${DELETION_DIR}/reconcileStartedDeletions.ts`]: '5c03f76721a79c4cb37db9e8fa52efb912f2e7f83b26729d50e7fdd56e61a55b',
    'app/api/cron/deletion-sweep/route.ts': '1a77481e9d2104fb3a2329bf2a5f05dd7e0ca0455dc3e329291c5a1172adbb67',
    'vercel.json': 'bf170f51c6a40599535816fe56445c1cc718678d088ab23d8705fc093c9e0da4',
    'supabase/migrations/20240073_deletion_schema_foundation.sql': '1a75a2f72346b3dc9cda36f6aba9ee56c0f3e20858961f87b55ac88d7c2f2827',
    'supabase/migrations/20240074_failed_story_deletion.sql': 'dbb996df4f7a502bfd196f5f8fbb9046f89d4457b23d90b85f199ce9fb6427fe',
    'supabase/migrations/20240075_deletion_count_durability.sql': '437b93cbd4a2f1a2672ad59eb5d65e7c3fba7c71cf318e00256e00c969bfca08',
  }
  for (const [rel, hash] of Object.entries(pinned)) assert.equal(sha(rel), hash, `${rel} changed`)
  assert.equal(readdirSync(resolve(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().at(-1), '20240075_deletion_count_durability.sql', 'no new migration in 3C-8')
})
