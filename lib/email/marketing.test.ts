// Run: node --experimental-strip-types --test lib/email/marketing.test.ts
//
// Marketing email unsubscribe + suppression. Pure tests over lib/email/
// marketing.ts and unsubscribe.ts with an in-memory store and a fake provider,
// plus source-level policy guards on the senders and the drip cron so a future
// marketing sequence cannot quietly bypass the suppression check.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  deliverMarketingEmail, unsubscribeWithToken, memorySuppressionStore, MARKETING_FOOTER,
  type ProviderMessage,
} from './marketing.ts'
import {
  normalizeEmail, signUnsubscribeToken, verifyUnsubscribeToken, getUnsubscribeSecret, UNSUBSCRIBE_SECRET_ENV,
} from './unsubscribe.ts'
import { renderEmail, storyFailedEmail } from './layout.ts'

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef'
const OTHER_SECRET = 'other-secret-0123456789abcdef0123456789abcdef'
const APP = 'https://nestandquill.com'

/** Code only: drops // comment lines so policy greps match calls, not prose. */
function stripComments(src: string): string {
  return src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
}

function fakeProvider() {
  const sent: ProviderMessage[] = []
  return { sent, send: async (m: ProviderMessage) => { sent.push(m) } }
}

function message(toEmail: string, lang?: 'en' | 'es') {
  return { toEmail, subject: 'Ideas for sharing the storybook', preheader: 'pre', body: '<p>Hi</p>', lang }
}

// ── 5. normalization ─────────────────────────────────────────────────────────

test('5. emails normalize case-insensitively and junk is rejected', () => {
  assert.equal(normalizeEmail('  Parent@Example.COM '), 'parent@example.com')
  assert.equal(normalizeEmail('parent@example.com'), 'parent@example.com')
  for (const bad of ['', 'nope', '@x.com', 'a@', 'a@@b.com', 'a b@c.com', 'a<b>@c.com', null, 42]) {
    assert.equal(normalizeEmail(bad), null, `should reject ${String(bad)}`)
  }
})

// ── 1–4. token design ────────────────────────────────────────────────────────

test('1. a valid token verifies to its claims and performs the unsubscribe', async () => {
  const token = signUnsubscribeToken({ email: 'parent@example.com', lang: 'en' }, SECRET)
  assert.deepEqual(verifyUnsubscribeToken(token, SECRET), { email: 'parent@example.com', lang: 'en' })
  assert.doesNotMatch(token, /parent@example\.com/, 'raw address never appears in the URL token')
  assert.doesNotMatch(token, /[^A-Za-z0-9_.-]/, 'token is URL-safe')

  const store = memorySuppressionStore()
  const result = await unsubscribeWithToken(token, { store, source: 'unsubscribe_link', secret: SECRET })
  assert.deepEqual(result, { ok: true, lang: 'en', alreadySuppressed: false })
  assert.equal(store.rows.get('parent@example.com'), 'unsubscribe_link')
})

test('2. repeated unsubscribe is idempotent and keeps the first record', async () => {
  const token = signUnsubscribeToken({ email: 'parent@example.com', lang: 'en' }, SECRET)
  const store = memorySuppressionStore()
  await unsubscribeWithToken(token, { store, source: 'unsubscribe_link', secret: SECRET })
  const again = await unsubscribeWithToken(token, { store, source: 'one_click', secret: SECRET })
  assert.deepEqual(again, { ok: true, lang: 'en', alreadySuppressed: true })
  assert.equal(store.rows.size, 1)
  assert.equal(store.rows.get('parent@example.com'), 'unsubscribe_link', 'second call does not overwrite the source')
})

test('3. tampered, truncated, foreign-secret and malformed tokens all fail safely', async () => {
  const good = signUnsubscribeToken({ email: 'parent@example.com', lang: 'en' }, SECRET)
  const [v, payload, sig] = good.split('.')
  const forgedPayload = Buffer.from(JSON.stringify({ e: 'victim@example.com', l: 'en' }), 'utf8').toString('base64url')
  const candidates: unknown[] = [
    `${v}.${forgedPayload}.${sig}`,                     // payload swapped, signature kept
    `${v}.${payload}.${sig.slice(0, -2)}xx`,            // signature edited
    `${v}.${payload}.${sig.slice(0, -1)}`,              // signature truncated
    `${v}.${payload}`,                                  // no signature
    `v0.${payload}.${sig}`,                             // unknown version
    signUnsubscribeToken({ email: 'parent@example.com', lang: 'en' }, OTHER_SECRET), // other secret
    '', 'parent@example.com', null, undefined, 42, {},  // junk
    `${v}.${'A'.repeat(3000)}.${sig}`,                   // oversized
  ]
  const store = memorySuppressionStore()
  for (const c of candidates) {
    assert.equal(verifyUnsubscribeToken(c, SECRET), null, `verify should reject ${String(c).slice(0, 40)}`)
    assert.deepEqual(await unsubscribeWithToken(c, { store, source: 'unsubscribe_link', secret: SECRET }), { ok: false })
  }
  assert.equal(store.rows.size, 0, 'nothing suppressed by a bad token')
})

test('4. a raw email address, or a payload-only forgery, cannot suppress anyone', async () => {
  const store = memorySuppressionStore()
  const raw = 'victim@example.com'
  const selfSigned = `v1.${Buffer.from(JSON.stringify({ e: raw, l: 'en' })).toString('base64url')}.${Buffer.from('nosig').toString('base64url')}`
  for (const attempt of [raw, selfSigned, `v1.${raw}.${raw}`]) {
    assert.deepEqual(await unsubscribeWithToken(attempt, { store, source: 'unsubscribe_link', secret: SECRET }), { ok: false })
  }
  assert.equal(await store.isSuppressed(raw), false)
  // An invalid result carries no language and no address: nothing about the
  // target leaks, and the response for an unknown and a known address is identical.
  await store.suppress(raw, 'admin')
  assert.deepEqual(await unsubscribeWithToken(selfSigned, { store, source: 'unsubscribe_link', secret: SECRET }), { ok: false })
})

test('signing refuses an un-normalized address and the secret must be configured', () => {
  assert.throws(() => signUnsubscribeToken({ email: 'Parent@Example.com', lang: 'en' }, SECRET))
  assert.throws(() => getUnsubscribeSecret({}), new RegExp(UNSUBSCRIBE_SECRET_ENV))
  assert.throws(() => getUnsubscribeSecret({ [UNSUBSCRIBE_SECRET_ENV]: 'short' }))
  assert.equal(getUnsubscribeSecret({ [UNSUBSCRIBE_SECRET_ENV]: SECRET }), SECRET)
})

// ── 6–7, 9. delivery honours suppression ─────────────────────────────────────

test('6. a suppressed recipient is skipped before the provider is called (any casing)', async () => {
  const store = memorySuppressionStore(['parent@example.com'])
  const p = fakeProvider()
  for (const to of ['parent@example.com', 'Parent@Example.COM', '  parent@example.com ']) {
    const r = await deliverMarketingEmail(message(to), { store, appUrl: APP, send: p.send, secret: SECRET })
    assert.deepEqual(r, { sent: false, reason: 'suppressed', to: 'parent@example.com' })
  }
  assert.equal(p.sent.length, 0, 'Resend never called for a suppressed address')
})

test('7. an unsuppressed recipient is sent, with an unsubscribe link and List-Unsubscribe headers', async () => {
  const store = memorySuppressionStore(['someone-else@example.com'])
  const p = fakeProvider()
  const r = await deliverMarketingEmail(message('Parent@Example.com'), { store, appUrl: APP, send: p.send, secret: SECRET })
  assert.deepEqual(r, { sent: true, to: 'parent@example.com' })
  assert.equal(p.sent.length, 1)
  const m = p.sent[0]
  assert.equal(m.to, 'parent@example.com')
  assert.match(m.headers['List-Unsubscribe'], /^<https:\/\/nestandquill\.com\/api\/unsubscribe\?t=v1\./)
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  const link = m.html.match(/href="(https:\/\/nestandquill\.com\/unsubscribe\?t=[^"]+)"/)?.[1]
  assert.ok(link, 'footer carries the unsubscribe page link')
  const token = decodeURIComponent(link!.split('t=')[1])
  assert.deepEqual(verifyUnsubscribeToken(token, SECRET), { email: 'parent@example.com', lang: 'en' })
})

test('8–9. the link from a sent email unsubscribes that recipient, guest or account alike, and stops the next send', async () => {
  // Guest story recipient (no profile) and registered user are both just an
  // address to this system; the flow is identical.
  for (const to of ['guest-parent@example.com', 'registered-user@example.com']) {
    const store = memorySuppressionStore()
    const p = fakeProvider()
    await deliverMarketingEmail(message(to), { store, appUrl: APP, send: p.send, secret: SECRET })
    const token = decodeURIComponent(p.sent[0].html.match(/unsubscribe\?t=([^"]+)"/)![1])
    const u = await unsubscribeWithToken(token, { store, source: 'unsubscribe_link', secret: SECRET })
    assert.equal(u.ok, true)
    const next = await deliverMarketingEmail(message(to), { store, appUrl: APP, send: p.send, secret: SECRET })
    assert.deepEqual(next, { sent: false, reason: 'suppressed', to })
    assert.equal(p.sent.length, 1, `${to}: exactly one send before unsubscribe, none after`)
  }
})

test('an invalid address is refused without a provider call, and a missing secret fails closed', async () => {
  const store = memorySuppressionStore()
  const p = fakeProvider()
  assert.deepEqual(await deliverMarketingEmail(message('not-an-email'), { store, appUrl: APP, send: p.send, secret: SECRET }), { sent: false, reason: 'invalid_email', to: null })
  const saved = process.env[UNSUBSCRIBE_SECRET_ENV]
  delete process.env[UNSUBSCRIBE_SECRET_ENV]
  try {
    await assert.rejects(deliverMarketingEmail(message('parent@example.com'), { store, appUrl: APP, send: p.send }), new RegExp(UNSUBSCRIBE_SECRET_ENV))
  } finally {
    if (saved !== undefined) process.env[UNSUBSCRIBE_SECRET_ENV] = saved
  }
  assert.equal(p.sent.length, 0)
})

// ── 11–12. rendering ─────────────────────────────────────────────────────────

test('11. EN marketing footer explains why, links Unsubscribe, and does not claim service mail stops', async () => {
  const p = fakeProvider()
  await deliverMarketingEmail(message('parent@example.com', 'en'), { store: memorySuppressionStore(), appUrl: APP, send: p.send, secret: SECRET })
  const html = p.sent[0].html
  assert.match(html, /<html lang="en"/)
  assert.match(html, /You&#39;re receiving this email because you used Nest &amp; Quill\. You can unsubscribe from product and promotional emails at any time\./)
  assert.match(html, /<a href="https:\/\/nestandquill\.com\/unsubscribe\?t=[^"]+"[^>]*>Unsubscribe<\/a>/)
  assert.doesNotMatch(html, /all emails|stop receiving all/i)
  assert.match(html, /border-top:4px solid #c59a00/, 'branded card preserved')
})

test('12. ES marketing footer uses natural Spanish and the token carries the language', async () => {
  const p = fakeProvider()
  await deliverMarketingEmail(message('padre@example.com', 'es'), { store: memorySuppressionStore(), appUrl: APP, send: p.send, secret: SECRET })
  const html = p.sent[0].html
  assert.match(html, /<html lang="es"/)
  assert.match(html, /Recibes este correo porque usaste Nest &amp; Quill\. Puedes cancelar la suscripción a los correos de producto y promociones cuando quieras\./)
  assert.match(html, /<a href="https:\/\/nestandquill\.com\/unsubscribe\?t=[^"]+"[^>]*>Cancelar suscripción<\/a>/)
  const token = decodeURIComponent(html.match(/unsubscribe\?t=([^"]+)"/)![1])
  assert.deepEqual(verifyUnsubscribeToken(token, SECRET), { email: 'padre@example.com', lang: 'es' })
  const u = await unsubscribeWithToken(token, { store: memorySuppressionStore(), source: 'unsubscribe_link', secret: SECRET })
  assert.deepEqual(u, { ok: true, lang: 'es', alreadySuppressed: false })
  assert.equal(MARKETING_FOOTER.es.includes('cancelar la suscripción'), true)
})

// ── 10. transactional protection ─────────────────────────────────────────────

test('10. transactional templates render with no unsubscribe link and never touch the suppression path', () => {
  // Layout without unsubscribeUrl (what every transactional sender passes) is unchanged.
  const plain = renderEmail({ appUrl: APP, title: 't', body: '<p>x</p>', footerNote: 'You created a story.' })
  assert.doesNotMatch(plain, /unsubscribe/i)
  const failed = storyFailedEmail({ appUrl: APP, childName: 'Mia', requestId: 'r1' }).html
  assert.doesNotMatch(failed, /unsubscribe/i)
  const failedEs = storyFailedEmail({ lang: 'es', appUrl: APP, childName: 'Mia', requestId: 'r1' }).html
  assert.doesNotMatch(failedEs, /suscripci/i)

  // Source policy: the transactional senders call Resend directly and never
  // the marketing path; only the three drip senders call sendMarketingEmail.
  const email = stripComments(readFileSync('lib/services/email.ts', 'utf8'))
  const fnBody = (name: string) => {
    const start = email.indexOf(`export async function ${name}(`)
    assert.ok(start >= 0, `${name} exists`)
    const next = email.indexOf('\nexport ', start + 1)
    return email.slice(start, next < 0 ? undefined : next)
  }
  for (const transactional of ['sendBookReadyEmail', 'sendSubmissionConfirmationEmail', 'sendWelcomeEmail', 'sendStoryErrorEmail']) {
    const body = fnBody(transactional)
    assert.doesNotMatch(body, /sendMarketingEmail|deliverMarketingEmail|isSuppressed|unsubscribe/i, `${transactional} must not consult suppression`)
    assert.match(body, /resend\.emails\.send\(/, `${transactional} sends directly`)
  }
  for (const marketing of ['sendStoryDripEmail', 'sendSignupDripEmail', 'sendDripEmailFromTemplate']) {
    const body = fnBody(marketing)
    assert.match(body, /return sendMarketingEmail\(/, `${marketing} goes through the marketing path`)
    assert.doesNotMatch(body, /resend\.emails\.send\(/, `${marketing} must not call Resend directly`)
  }
  // Auth mail (confirm signup, password reset) is Supabase Auth's own template
  // path and shares nothing with this module.
  for (const tpl of ['supabase/templates/confirm-signup.html', 'supabase/templates/reset-password.html']) {
    assert.doesNotMatch(readFileSync(tpl, 'utf8'), /unsubscribe/i)
  }
  // The Edge Function (story ready / failed) renders from the mirrored layout
  // and never sets unsubscribeUrl.
  assert.doesNotMatch(readFileSync('supabase/functions/process-story/index.ts', 'utf8'), /unsubscribeUrl|marketing_email_suppressions/)
})

// ── Cron policy ──────────────────────────────────────────────────────────────

test('drip cron fails closed without the secret, sends only via the marketing senders, and logs only real sends', () => {
  const cron = stripComments(readFileSync('app/api/cron/drip-emails/route.ts', 'utf8'))
  assert.match(cron, /getUnsubscribeSecret\(\)/, 'cron checks the signing secret up front')
  assert.match(cron, /status:\s*500/, 'cron aborts when the secret is missing')
  assert.doesNotMatch(cron, /resend|Resend/, 'cron never talks to the provider directly')
  assert.doesNotMatch(cron, /emailShell|renderEmail/, 'cron never renders mail itself')
  const sends = cron.match(/send(StoryDripEmail|SignupDripEmail|DripEmailFromTemplate)\(/g) ?? []
  assert.equal(sends.length, 4, 'two sequences × (template | hardcoded) senders')
  // Every send result is checked before the delivery log is written.
  const logs = cron.split("from('drip_email_log').insert(").length - 1
  assert.equal(logs, 2)
  const guards = cron.split('if (!outcome.sent) {').length - 1
  assert.equal(guards, 2, 'each log write is preceded by a sent-guard')
  assert.match(cron, /results\.suppressed\+\+/)
  // Sequences covered today.
  assert.match(cron, /sequence === 'story'/)
  assert.match(cron, /sequence === 'signup'/)
})

test('migration adds a service-role-only suppression table keyed by normalized email; unsubscribe page bypasses maintenance', () => {
  const sql = readFileSync('supabase/migrations/20240069_marketing_email_suppressions.sql', 'utf8')
    .split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.marketing_email_suppressions/)
  assert.match(sql, /email\s+TEXT\s+PRIMARY KEY/)
  assert.match(sql, /CHECK \(email = lower\(btrim\(email\)\)/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(sql, /CREATE POLICY/, 'no policies: service role only')
  assert.doesNotMatch(sql, /user_id/, 'suppression is independent of profiles.user_id')
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|TRUNCATE/, 'forward-only, touches no existing data')
  const mw = readFileSync('middleware.ts', 'utf8')
  assert.match(mw, /'\/unsubscribe',/)
})
