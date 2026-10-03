import { Resend } from 'resend'
import { getSetting } from '@/lib/settings/appSettings'
import { appUrl, getAppUrl } from '@/lib/utils/appUrl'
import { getDictionary, fill, resolveLang, type Lang } from '@/lib/i18n'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

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
  const { toEmail, childName, storyTitle, downloadUrl } = options
  const lang = resolveLang(options.lang)
  const t = getDictionary(lang).email
  const r = t.ready

  // Honest disclaimer: only when the operator has paused image generation
  // (image_generation_enabled = false) do we tell the reader illustrations
  // were skipped. Beta Mode on its own no longer affects illustrations.
  const imagesPaused = await getSetting<unknown>('image_generation_enabled', true).catch(() => true) === false
  const betaNote = imagesPaused
    ? `<p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#777;line-height:1.6;font-style:italic;">
         ${r.imagesPaused}
       </p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fill(r.subject, { name: childName })}</title>
</head>
<body style="margin:0;padding:0;background:#F8F5EC;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5EC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px;">
                Nest &amp; Quill
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e0d5;padding:40px 36px;">

              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                ${fill(r.title, { name: childName })}
              </p>

              <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;color:#555;line-height:1.6;">
                ${fill(r.body, { title: storyTitle })}
              </p>

              <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#777;line-height:1.6;">
                ${r.hint}
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#C99700;border-radius:10px;">
                    <a href="${downloadUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      ${fill(r.cta, { name: childName })}
                    </a>
                  </td>
                </tr>
              </table>

              ${betaNote}

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #ede8e0;margin:32px 0;" />

              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#aaa;line-height:1.6;">
                ${t.linkFallback}<br/>
                <a href="${downloadUrl}" style="color:#C99700;word-break:break-all;">${downloadUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbb;">
                ${t.footer}<br/>
                © ${new Date().getFullYear()} Nest &amp; Quill. ${t.rights}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: 'Nest & Quill by Bright Tale Books <stories@nestandquill.com>',
    to: toEmail,
    subject: fill(r.subject, { name: childName }),
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

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fill(s.subject, { name: childName })}</title>
</head>
<body style="margin:0;padding:0;background:#F8F5EC;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5EC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">
                Nest &amp; Quill
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e0d5;padding:40px 36px;">

              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                ${fill(s.title, { name: childName })}
              </p>

              <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;color:#555;line-height:1.6;">
                ${fill(s.body, { name: childName })}
              </p>

              <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#777;line-height:1.6;">
                ${s.hint}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#C99700;border-radius:10px;">
                    <a href="${storyUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      ${s.cta}
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #ede8e0;margin:32px 0;" />

              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#aaa;line-height:1.6;">
                <a href="${storyUrl}" style="color:#C99700;word-break:break-all;">${storyUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbb;">
                ${t.footer}<br/>
                © ${new Date().getFullYear()} Nest &amp; Quill. ${t.rights}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: 'Nest & Quill by Bright Tale Books <stories@nestandquill.com>',
    to: toEmail,
    subject: fill(s.subject, { name: childName }),
    html,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}

// ── Shared email shell ────────────────────────────────────────────────────────

const APP_URL = getAppUrl()
const FROM = 'Nest & Quill by Bright Tale Books <stories@nestandquill.com>'

function emailShell(bodyContent: string, lang: Lang = 'en', footerText?: string): string {
  const t = getDictionary(lang).email
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F8F5EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr>
          <td style="padding-bottom:28px;text-align:center;">
            <p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#0C2340;letter-spacing:-0.3px;">
              Nest &amp; Quill
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e0d5;padding:36px 32px;">
            ${bodyContent}
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">
              ${footerText ?? t.welcome.footer}<br/>
              © ${new Date().getFullYear()} Nest &amp; Quill. ${t.rights}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="background:#C99700;border-radius:10px;">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

// ── Story drip emails ─────────────────────────────────────────────────────────

export interface StoryDripOptions {
  toEmail: string
  childName: string
  requestId: string
  planTier: string
  /** Authoritative PDF entitlement; falls back to the label only for callers that predate it. */
  pdfEntitled?: boolean
}

export async function sendStoryDripEmail(step: number, opts: StoryDripOptions): Promise<void> {
  const { toEmail, childName, requestId, planTier, pdfEntitled } = opts
  const storyUrl = `${APP_URL}/story/${requestId}`
  const canDownload = typeof pdfEntitled === 'boolean' ? pdfEntitled : planTier !== 'free'

  let subject: string
  let html: string

  if (step === 2) {
    subject = `${childName}'s story — here's what you can do with it 📖`
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        Your story is ready to enjoy
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        <strong style="color:#2E2E2E;">${childName}'s story</strong> is waiting for you. Here are a few ways to make the most of it:
      </p>
      <ul style="margin:16px 0 0;padding-left:20px;font-size:14px;color:#555;line-height:2;">
        <li>📱 Read it on your phone or tablet — perfect for bedtime</li>
        <li>🖨️ Print it at home for a physical copy</li>
        ${canDownload ? '<li>⬇️ Download the full PDF — it\'s already waiting for you</li>' : '<li>⬇️ Upgrade to download a beautifully formatted PDF</li>'}
        <li>🎁 Share the link with family and friends</li>
      </ul>
      ${ctaButton(`Read ${childName}'s story →`, storyUrl)}
      <hr style="border:none;border-top:1px solid #ede8e0;margin:28px 0;" />
      <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
        Can't click the button? <a href="${storyUrl}" style="color:#C99700;">${storyUrl}</a>
      </p>
    `)
  } else if (step === 4) {
    subject = `Ideas for sharing ${childName}'s storybook`
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        Make it a memory
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        ${childName}'s story is more than a one-time read. Here are some ideas:
      </p>
      <ul style="margin:16px 0 0;padding-left:20px;font-size:14px;color:#555;line-height:2.2;">
        <li>🌙 Make it your official <strong>bedtime story</strong> for a week</li>
        <li>👵 Send the link to grandparents, aunts, and uncles</li>
        <li>🎂 Print it as a <strong>birthday gift</strong> — kids love seeing their name in a book</li>
        <li>📚 Save it as a yearly tradition — create a new story each birthday</li>
      </ul>
      <p style="margin:20px 0 0;font-size:15px;color:#555;line-height:1.7;">
        Want another story? We can make one for a sibling, a friend, or a whole new adventure for ${childName}.
      </p>
      ${ctaButton('Create another story →', `${APP_URL}/create`)}
    `)
  } else if (step === 6) {
    subject = `How did ${childName} like their story? 💛`
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        We'd love to hear from you
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        It means the world to us when families enjoy their stories. What did ${childName} think?
      </p>
      <p style="margin:12px 0 0;font-size:15px;color:#555;line-height:1.7;">
        Just reply to this email with a quick note — a reaction, a quote, even a photo — and we'll send you <strong style="color:#0C2340;">15% off your next story</strong> as a thank you.
      </p>
      ${ctaButton(`Read ${childName}'s story again →`, storyUrl)}
      <hr style="border:none;border-top:1px solid #ede8e0;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        Simply reply to this email to share your feedback and claim your discount.
      </p>
    `)
  } else {
    return
  }

  const resend = getResend()
  const { error } = await resend.emails.send({ from: FROM, to: toEmail, subject, html })
  if (error) throw new Error(`Resend error (story drip step ${step}): ${error.message}`)
}

// ── Signup drip emails ────────────────────────────────────────────────────────

export interface SignupDripOptions {
  toEmail: string
}

export async function sendSignupDripEmail(step: number, opts: SignupDripOptions): Promise<void> {
  const { toEmail } = opts
  const createUrl = `${APP_URL}/create`
  const pricingUrl = `${APP_URL}/pricing`

  let subject: string
  let html: string

  if (step === 1) {
    subject = 'Your story is waiting to be written ✨'
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        Still thinking about it?
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        Creating a personalized storybook takes about 5 minutes — and it's free to try. Just tell us:
      </p>
      <ul style="margin:16px 0 0;padding-left:20px;font-size:14px;color:#555;line-height:2;">
        <li>The child's name and age</li>
        <li>A story theme (we have presets to pick from)</li>
        <li>A tone — silly, magical, adventurous, heartwarming</li>
      </ul>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        We handle the writing, the illustrations, and the delivery. All you have to do is enjoy it.
      </p>
      ${ctaButton('Create my story →', createUrl)}
    `)
  } else if (step === 3) {
    subject = "Here's what you get when your story is done"
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        A complete storybook — in minutes
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        Here's exactly what you get when your story finishes generating:
      </p>
      <ul style="margin:16px 0 0;padding-left:20px;font-size:14px;color:#555;line-height:2.2;">
        <li>📖 A full illustrated storybook starring your child</li>
        <li>🎨 AI illustrations in your chosen art style (watercolor, cartoon, and more)</li>
        <li>✉️ Email delivery with a link to read it immediately</li>
        <li>⬇️ PDF download on paid plans — printable and shareable</li>
        <li>💌 An optional dedication page and custom author name</li>
      </ul>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        The free plan gives you one 8-page story to try it out — no card required.
      </p>
      ${ctaButton('Create my free story →', createUrl)}
    `)
  } else if (step === 5) {
    subject = 'Every day, families are making memories with Nest & Quill'
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        Real stories, real smiles
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        Here's how families are using their personalized stories:
      </p>
      <div style="margin:20px 0;padding:16px 20px;background:#F8F5EC;border-left:3px solid #C99700;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#2E2E2E;line-height:1.7;font-style:italic;">
          "I made a bedtime story for my daughter featuring her and our golden retriever. She asks for it every night now."
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#888;">— A Nest &amp; Quill parent</p>
      </div>
      <div style="margin:16px 0 0;padding:16px 20px;background:#F8F5EC;border-left:3px solid #C99700;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#2E2E2E;line-height:1.7;font-style:italic;">
          "My son cried happy tears when he saw his name on the cover. Worth every penny."
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#888;">— A Nest &amp; Quill parent</p>
      </div>
      <p style="margin:20px 0 0;font-size:15px;color:#555;line-height:1.7;">
        Your story is just a few minutes away.
      </p>
      ${ctaButton('Create my story now →', createUrl)}
    `)
  } else if (step === 7) {
    subject = 'Want more stories? Here are your options'
    html = emailShell(`
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;line-height:1.2;">
        Ready for more?
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
        The free plan is a great start, but if you love your story and want more:
      </p>
      <table style="margin:20px 0;width:100%;border-collapse:collapse;">
        <tr style="background:#0C2340;color:#F8F5EC;">
          <td style="padding:10px 14px;font-size:13px;font-weight:600;border-radius:8px 0 0 0;">Plan</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:600;">Stories</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:600;border-radius:0 8px 0 0;">Price</td>
        </tr>
        <tr style="background:#fff;border-bottom:1px solid #ede8e0;">
          <td style="padding:10px 14px;font-size:13px;color:#2E2E2E;">Single Story</td>
          <td style="padding:10px 14px;font-size:13px;color:#555;">1 story, yours forever</td>
          <td style="padding:10px 14px;font-size:13px;color:#555;">$7.99 once</td>
        </tr>
        <tr style="background:#fff;border-bottom:1px solid #ede8e0;">
          <td style="padding:10px 14px;font-size:13px;color:#2E2E2E;">Story Pack</td>
          <td style="padding:10px 14px;font-size:13px;color:#555;">3 stories/month</td>
          <td style="padding:10px 14px;font-size:13px;color:#555;">$9.99/mo</td>
        </tr>
        <tr style="background:#fff;">
          <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0C2340;">Story Pro ★</td>
          <td style="padding:10px 14px;font-size:13px;color:#555;">10 stories/month</td>
          <td style="padding:10px 14px;font-size:13px;color:#555;">$24.99/mo</td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
        All paid plans include full PDF downloads, all illustration styles, and a dedication page.
      </p>
      ${ctaButton('See all plans →', pricingUrl)}
    `)
  } else {
    return
  }

  const resend = getResend()
  const { error } = await resend.emails.send({ from: FROM, to: toEmail, subject, html })
  if (error) throw new Error(`Resend error (signup drip step ${step}): ${error.message}`)
}

// ── Generic template-based drip email sender ─────────────────────────────────

export async function sendDripEmailFromTemplate(
  template: { subject: string; body_html: string },
  opts: {
    toEmail: string
    variables?: Record<string, string>
  }
): Promise<void> {
  let subject = template.subject
  let body = template.body_html

  // Replace placeholders
  for (const [key, value] of Object.entries(opts.variables ?? {})) {
    const placeholder = `{${key}}`
    subject = subject.replaceAll(placeholder, value)
    body = body.replaceAll(placeholder, value)
  }

  const html = emailShell(body)
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    subject,
    html,
  })
  if (error) throw new Error(`Resend error (template drip): ${error.message}`)
}

// ── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(toEmail: string, langInput: Lang | string = 'en'): Promise<void> {
  const createUrl = `${APP_URL}/create`
  const lang = resolveLang(langInput)
  const w = getDictionary(lang).email.welcome
  const html = emailShell(`
    <h1 style="margin:0 0 12px;font-size:26px;color:#0C2340;line-height:1.2;">
      ${w.title}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#2E2E2E;line-height:1.7;">
      ${w.intro}
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#2E2E2E;line-height:1.7;">
      ${w.what}
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#2E2E2E;line-height:1.9;">
      ${w.items.map(item => `<li>${item}</li>`).join('\n      ')}
    </ul>
    ${ctaButton(w.cta, createUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#4a4a4a;line-height:1.6;">
      ${w.outro}
    </p>
  `, lang, w.footer)

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
// which is a Deno Edge Function and cannot import from lib/. The error email is
// sent inline there. This function exists as a type-safe reference and could be
// used if a Node.js caller ever needs to send a failure notification directly.

export async function sendStoryErrorEmail(opts: {
  toEmail: string
  childName: string
  requestId: string
}): Promise<void> {
  const { toEmail, childName, requestId } = opts
  const retryUrl = `${APP_URL}/story/${requestId}`
  const html = emailShell(`
    <h1 style="margin:0 0 12px;font-size:26px;color:#0C2340;line-height:1.2;">
      Something went wrong with ${childName}'s story
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#2E2E2E;line-height:1.7;">
      We ran into a problem while generating ${childName}'s storybook. We're sorry
      about the interruption — this doesn't happen often.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#2E2E2E;line-height:1.7;">
      You can try again from the story page — it only takes a moment and there's
      no charge.
    </p>
    ${ctaButton('Try again →', retryUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#4a4a4a;line-height:1.6;">
      If the problem keeps happening, reply to this email and we'll sort it out.
    </p>
  `)

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `We hit a snag with ${childName}'s story`,
    html,
  })
  if (error) throw new Error(`Resend error (story error): ${error.message}`)
}
