import { Resend } from 'resend'
import { getSetting } from '@/lib/settings/appSettings'
import { appUrl, getAppUrl } from '@/lib/utils/appUrl'
import { getDictionary, fill, resolveLang, type Lang } from '@/lib/i18n'
import {
  renderEmail, heading, paragraph, button, bulletList, divider, linkFallback,
  quote, dataTable, escapeHtml, storyFailedEmail,
} from '@/lib/email/layout'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_CONFIG } from '@/lib/plans/config'
import { FREE_GUEST_BOOKS, FREE_LIFETIME_BOOKS, TIER_CAPS } from '@/lib/entitlements/policy'
import {
  deliverMarketingEmail, createSupabaseSuppressionStore,
  type MarketingMessage, type MarketingSendResult, type ProviderMessage,
} from '@/lib/email/marketing'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const APP_URL = getAppUrl()
const FROM = 'Nest & Quill by Bright Tale Books <stories@nestandquill.com>'

export interface SendBookEmailOptions {
  toEmail: string
  childName: string
  storyTitle: string
  downloadUrl: string
  requestId: string
  /** Customer language (the request's persisted locale). Defaults to English. */
  lang?: Lang
}

export async function sendBookReadyEmail(
  options: SendBookEmailOptions
): Promise<{ messageId: string }> {
  const { toEmail, downloadUrl } = options
  const lang = resolveLang(options.lang)
  const t = getDictionary(lang).email
  const r = t.ready
  const name = escapeHtml(options.childName)
  const subject = fill(r.subject, { name: options.childName })

  // Honest disclaimer: only when the operator has paused image generation
  // (image_generation_enabled = false) do we tell the reader illustrations
  // were skipped. Beta Mode on its own no longer affects illustrations.
  const imagesPaused = await getSetting<unknown>('image_generation_enabled', true).catch(() => true) === false

  const html = renderEmail({
    lang,
    appUrl: APP_URL,
    title: subject,
    preheader: r.preheader,
    footerNote: t.footer,
    body: [
      heading(fill(r.title, { name })),
      paragraph(fill(r.body, { title: escapeHtml(options.storyTitle) })),
      paragraph(r.hint, { muted: true }),
      button(fill(r.cta, { name }), downloadUrl),
      imagesPaused ? paragraph(r.imagesPaused, { small: true, muted: true, italic: true }) : '',
      divider(),
      linkFallback(t.linkFallback, downloadUrl),
    ].join('\n'),
  })

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject,
    html,
  })

  if (error || !data?.id) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`)
  }

  return { messageId: data.id }
}

export async function sendSubmissionConfirmationEmail(
  toEmail: string,
  childName: string,
  requestId: string,
  langInput: Lang | string = 'en'
): Promise<void> {
  const storyUrl = appUrl(`/story/${requestId}`)
  const lang = resolveLang(langInput)
  const t = getDictionary(lang).email
  const s = t.submitted
  const name = escapeHtml(childName)
  const subject = fill(s.subject, { name: childName })

  const html = renderEmail({
    lang,
    appUrl: APP_URL,
    title: subject,
    preheader: s.preheader,
    footerNote: t.footer,
    body: [
      heading(fill(s.title, { name })),
      paragraph(fill(s.body, { name })),
      paragraph(s.hint, { muted: true }),
      button(s.cta, storyUrl),
      divider(),
      linkFallback(t.linkFallback, storyUrl),
    ].join('\n'),
  })

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject,
    html,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}

// ── Shared email shell ────────────────────────────────────────────────────────
// Transactional customer emails that are English-only today share the same
// branded layout as the localized ones above. Marketing mail does NOT use this
// shell: it goes through sendMarketingEmail() below so it is suppression-checked
// and carries an unsubscribe link.

function emailShell(bodyContent: string, subject: string, opts: { lang?: Lang; footerNote?: string; preheader?: string } = {}): string {
  const lang = opts.lang ?? 'en'
  return renderEmail({
    lang,
    appUrl: APP_URL,
    title: subject,
    preheader: opts.preheader,
    footerNote: opts.footerNote ?? getDictionary(lang).email.welcome.footer,
    body: bodyContent,
  })
}

// ── Marketing / product-engagement sends ─────────────────────────────────────
// The ONLY way marketing mail leaves this module. Every drip sender below and
// any future promotional or re-engagement sequence must call this, never
// resend.emails.send() directly, so the suppression check in
// lib/email/marketing.ts cannot be bypassed. Transactional senders above and
// below (ready, submitted, welcome, story error) do not and must not use it.

export type { MarketingSendResult }

async function resendMarketingProvider(message: ProviderMessage): Promise<void> {
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    headers: message.headers,
  })
  if (error) throw new Error(`Resend error (marketing): ${error.message}`)
}

export async function sendMarketingEmail(message: MarketingMessage): Promise<MarketingSendResult> {
  return deliverMarketingEmail(message, {
    store: createSupabaseSuppressionStore(createAdminClient()),
    appUrl: APP_URL,
    send: resendMarketingProvider,
  })
}

// ── Story drip emails (marketing) ────────────────────────────────────────────

export interface StoryDripOptions {
  toEmail: string
  childName: string
  requestId: string
  planTier: string
  /** Authoritative PDF entitlement; falls back to the label only for callers that predate it. */
  pdfEntitled?: boolean
}

export async function sendStoryDripEmail(step: number, opts: StoryDripOptions): Promise<MarketingSendResult> {
  const { toEmail, childName, requestId, planTier, pdfEntitled } = opts
  const storyUrl = `${APP_URL}/story/${requestId}`
  const canDownload = typeof pdfEntitled === 'boolean' ? pdfEntitled : planTier !== 'free'
  const name = escapeHtml(childName)

  let subject: string
  let body: string
  let preheader: string

  if (step === 2) {
    subject = `${childName}'s story — here's what you can do with it 📖`
    preheader = 'Bedtime reading, printing at home, and sharing with family.'
    body = [
      heading('Your story is ready to enjoy'),
      paragraph(`<strong style="color:#0f2140;">${name}'s story</strong> is waiting for you. Here are a few ways to make the most of it:`),
      bulletList([
        '📱 Read it on your phone or tablet — perfect for bedtime',
        '🖨️ Print it at home for a physical copy',
        canDownload ? "⬇️ Download the full PDF — it's already waiting for you" : '⬇️ Upgrade to download a beautifully formatted PDF',
        '🎁 Share the link with family and friends',
      ]),
      button(`Read ${name}'s story →`, storyUrl),
      divider(),
      linkFallback("Can't click the button?", storyUrl),
    ].join('\n')
  } else if (step === 4) {
    subject = `Ideas for sharing ${childName}'s storybook`
    preheader = `Ways to turn ${childName}'s story into a keepsake.`
    body = [
      heading('Make it a memory'),
      paragraph(`${name}'s story is more than a one-time read. Here are some ideas:`),
      bulletList([
        '🌙 Make it your official <strong>bedtime story</strong> for a week',
        '👵 Send the link to grandparents, aunts, and uncles',
        '🎂 Print it as a <strong>birthday gift</strong> — kids love seeing their name in a book',
        '📚 Save it as a yearly tradition — create a new story each birthday',
      ]),
      paragraph(`Want another story? We can make one for a sibling, a friend, or a whole new adventure for ${name}.`),
      button('Create another story →', `${APP_URL}/create`),
    ].join('\n')
  } else if (step === 6) {
    subject = `How did ${childName} like their story? 💛`
    preheader = 'Reply with a quick note and get 15% off your next story.'
    body = [
      heading("We'd love to hear from you"),
      paragraph(`It means the world to us when families enjoy their stories. What did ${name} think?`),
      paragraph('Just reply to this email with a quick note — a reaction, a quote, even a photo — and we\'ll send you <strong style="color:#0f2140;">15% off your next story</strong> as a thank you.'),
      button(`Read ${name}'s story again →`, storyUrl),
      divider(),
      paragraph('Simply reply to this email to share your feedback and claim your discount.', { small: true, muted: true }),
    ].join('\n')
  } else {
    return { sent: false, reason: 'unknown_step', to: null }
  }

  return sendMarketingEmail({ toEmail, subject, preheader, body })
}

// ── Signup drip emails (marketing) ───────────────────────────────────────────

export interface SignupDripOptions {
  toEmail: string
}

export async function sendSignupDripEmail(step: number, opts: SignupDripOptions): Promise<MarketingSendResult> {
  const { toEmail } = opts
  const createUrl = `${APP_URL}/create`
  const pricingUrl = `${APP_URL}/pricing`

  let subject: string
  let body: string
  let preheader: string

  if (step === 1) {
    subject = 'Your story is waiting to be written ✨'
    preheader = "It takes about 5 minutes and it's free to try."
    body = [
      heading('Still thinking about it?'),
      paragraph("Creating a personalized storybook takes about 5 minutes — and it's free to try. Just tell us:"),
      bulletList([
        "The child's name and age",
        'A story theme (we have presets to pick from)',
        'A tone — silly, magical, adventurous, heartwarming',
      ]),
      paragraph('We handle the writing, the illustrations, and the delivery. All you have to do is enjoy it.'),
      button('Create my story →', createUrl),
    ].join('\n')
  } else if (step === 3) {
    subject = "Here's what you get when your story is done"
    preheader = 'A full illustrated storybook starring your child, delivered by email.'
    body = [
      heading('A complete storybook — in minutes'),
      paragraph("Here's exactly what you get when your story finishes generating:"),
      bulletList([
        '📖 A full illustrated storybook starring your child',
        '🎨 AI illustrations in your chosen art style (watercolor, cartoon, and more)',
        '✉️ Email delivery with a link to read it immediately',
        '⬇️ PDF download on paid plans — printable and shareable',
        '💌 An optional dedication page and custom author name',
      ]),
      paragraph(`The free plan gives you ${FREE_LIFETIME_BOOKS} ${TIER_CAPS.free.maxPages}-page stories to try it out — ${FREE_GUEST_BOOKS} of them before you even create an account. No card required.`),
      button('Create my free story →', createUrl),
    ].join('\n')
  } else if (step === 5) {
    subject = 'Every day, families are making memories with Nest & Quill'
    preheader = 'How families are using their personalized stories.'
    body = [
      heading('Real stories, real smiles'),
      paragraph("Here's how families are using their personalized stories:"),
      quote('I made a bedtime story for my daughter featuring her and our golden retriever. She asks for it every night now.', 'A Nest &amp; Quill parent'),
      quote('My son cried happy tears when he saw his name on the cover. Worth every penny.', 'A Nest &amp; Quill parent'),
      paragraph('Your story is just a few minutes away.'),
      button('Create my story now →', createUrl),
    ].join('\n')
  } else if (step === 7) {
    subject = 'Want more stories? Here are your options'
    preheader = 'Single stories from $7.99, or a monthly pack.'
    body = [
      heading('Ready for more?'),
      paragraph('The free plan is a great start, but if you love your story and want more:'),
      dataTable(['Plan', 'Stories', 'Price'], [
        ['Single Story', `1 story, yours forever (up to ${TIER_CAPS.single.maxPages} pages)`, `$${PLAN_CONFIG.single.priceMonthly} once`],
        ['Story Pack', `${TIER_CAPS.story_pack.periodAllowance} stories/month (up to ${TIER_CAPS.story_pack.maxPages} pages each)`, `$${PLAN_CONFIG.story_pack.priceMonthly}/mo`],
        ['<strong>Story Pro ★</strong>', `${TIER_CAPS.story_pro.periodAllowance} stories/month (up to ${TIER_CAPS.story_pro.maxPages} pages each)`, `$${PLAN_CONFIG.story_pro.priceMonthly}/mo`],
      ]),
      paragraph('Subscriptions bill monthly; cancel any time from your account.', { small: true, muted: true }),
      paragraph('All paid plans include full PDF downloads, all illustration styles, and a dedication page.', { small: true }),
      button('See all plans →', pricingUrl),
    ].join('\n')
  } else {
    return { sent: false, reason: 'unknown_step', to: null }
  }

  return sendMarketingEmail({ toEmail, subject, preheader, body })
}

// ── Generic template-based drip email sender (marketing) ─────────────────────

export async function sendDripEmailFromTemplate(
  template: { subject: string; body_html: string },
  opts: {
    toEmail: string
    variables?: Record<string, string>
  }
): Promise<MarketingSendResult> {
  let subject = template.subject
  let body = template.body_html

  // Replace placeholders. Subject is plain text; body values are escaped
  // because they come from customer input (e.g. child name).
  for (const [key, value] of Object.entries(opts.variables ?? {})) {
    const placeholder = `{${key}}`
    subject = subject.replaceAll(placeholder, value)
    body = body.replaceAll(placeholder, escapeHtml(value))
  }

  return sendMarketingEmail({ toEmail: opts.toEmail, subject, body })
}

// ── Welcome email (transactional: account-created notice) ────────────────────
// Sent once when a new account completes auth. Not routed through the
// marketing path on purpose; see the completion report if that should change.

export async function sendWelcomeEmail(toEmail: string, langInput: Lang | string = 'en'): Promise<void> {
  const createUrl = `${APP_URL}/create`
  const lang = resolveLang(langInput)
  const w = getDictionary(lang).email.welcome
  const html = emailShell([
    heading(w.title),
    paragraph(w.intro),
    paragraph(w.what),
    bulletList(w.items),
    button(w.cta, createUrl),
    paragraph(w.outro, { small: true, muted: true }),
  ].join('\n'), w.subject, { lang, footerNote: w.footer, preheader: w.preheader })

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: w.subject,
    html,
  })
  if (error) throw new Error(`Resend error (welcome): ${error.message}`)
}

// ── Story error email ─────────────────────────────────────────────────────────
// NOTE: This function is intentionally not called from Next.js routes.
// Story failures are handled inside supabase/functions/process-story/index.ts,
// which is a Deno Edge Function and cannot import from lib/. It renders the
// same template from its mirror of lib/email/layout.ts (storyFailedEmail).
// This function exists as a type-safe reference and could be used if a
// Node.js caller ever needs to send a failure notification directly.

export async function sendStoryErrorEmail(opts: {
  toEmail: string
  childName: string
  requestId: string
  lang?: Lang
}): Promise<void> {
  const { toEmail, childName, requestId } = opts
  const { subject, html } = storyFailedEmail({ lang: resolveLang(opts.lang), appUrl: APP_URL, childName, requestId })

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject,
    html,
  })
  if (error) throw new Error(`Resend error (story error): ${error.message}`)
}
