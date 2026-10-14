// Branded email layout shared by every email Nest & Quill sends.
//
// Two runtimes render these emails: the Next.js app (Resend SDK, lib/services)
// and the process-story Supabase Edge Function (Deno, raw Resend fetch), which
// cannot import from lib/. This file is therefore dependency-free and is
// mirrored byte-for-byte at supabase/functions/process-story/emailLayout.ts.
// lib/email/layout.test.ts fails if the two copies drift: edit this file, then
// `cp lib/email/layout.ts supabase/functions/process-story/emailLayout.ts`.
//
// Look matches the modern site (components/home/ModernHome.tsx): parchment
// background, white card with a gold top rule, navy text, gold primary button
// with navy label, Source Serif headings, Archivo body. Everything is inline
// styles + tables so Gmail, Apple Mail and Outlook render it the same.

export type EmailLang = 'en' | 'es'

export const BRAND = {
  bg: '#fbf9f4',
  surface: '#ffffff',
  text: '#0f2140',
  body: '#3f4a5e',
  muted: '#707b8f',
  border: '#dde1e8',
  accent: '#c59a00',
  accentSoft: '#f8f0d6',
  accentDeep: '#866800',
  success: '#1f7a4d',
  danger: '#b42318',
  fontHeading: "'Source Serif 4',Georgia,'Times New Roman',serif",
  fontBody: "Archivo,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
} as const

const CHROME: Record<EmailLang, { tagline: string; create: string; contact: string; rights: string; admin: string }> = {
  en: {
    tagline: 'Personalized storybooks starring your child',
    create: 'Create a story',
    contact: 'Contact us',
    rights: 'All rights reserved.',
    admin: 'Admin notification',
  },
  es: {
    tagline: 'Cuentos personalizados protagonizados por tu hijo o hija',
    create: 'Crear un cuento',
    contact: 'Contáctanos',
    rights: 'Todos los derechos reservados.',
    admin: 'Notificación de administración',
  },
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export interface EmailLayoutOptions {
  lang?: EmailLang
  /** Canonical site URL, e.g. https://nestandquill.com. Used for the logo and footer links. */
  appUrl: string
  /** Document <title>; usually the subject. Plain text, escaped here. */
  title: string
  /** Inbox preview line shown after the subject. Plain text, escaped here. */
  preheader?: string
  /** Inner HTML built from the helpers below. */
  body: string
  /** Why the reader got this email. Plain text, escaped here. */
  footerNote?: string
  /** 'internal' = team/admin notifications: adds an eyebrow label, drops marketing links. */
  audience?: 'customer' | 'internal'
}

export function renderEmail(opts: EmailLayoutOptions): string {
  const lang: EmailLang = opts.lang === 'es' ? 'es' : 'en'
  const c = CHROME[lang]
  const site = trimSlash(opts.appUrl)
  const internal = opts.audience === 'internal'
  const year = new Date().getFullYear()

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.bg};">${escapeHtml(opts.preheader)}${'&#8199;&#65279;&#847;'.repeat(40)}</div>`
    : ''

  const eyebrow = internal
    ? `<tr><td style="padding:0 0 12px;font-family:${BRAND.fontBody};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};text-align:center;">${c.admin}</td></tr>`
    : ''

  const footerLinks = internal
    ? `<a href="${site}/admin" style="color:${BRAND.text};font-weight:600;text-decoration:none;">Admin dashboard</a>`
    : `<a href="${site}/create" style="color:${BRAND.text};font-weight:600;text-decoration:none;">${c.create}</a>
       <span style="color:${BRAND.border};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
       <a href="${site}/contact" style="color:${BRAND.text};font-weight:600;text-decoration:none;">${c.contact}</a>`

  return `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(opts.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&amp;family=Source+Serif+4:wght@600;700&amp;display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-text-size-adjust:100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <tr>
            <td align="center" style="padding:0 0 24px;">
              <a href="${site}" style="text-decoration:none;color:${BRAND.text};">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:8px;vertical-align:middle;">
                      <img src="${site}/brand/email-quill.png" width="30" height="30" alt="" style="display:block;border:0;width:30px;height:30px;" />
                    </td>
                    <td style="vertical-align:middle;font-family:${BRAND.fontHeading};font-size:24px;font-weight:700;color:${BRAND.text};letter-spacing:-0.2px;">
                      Nest &amp; Quill
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          ${eyebrow}

          <tr>
            <td bgcolor="${BRAND.surface}" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-top:4px solid ${BRAND.accent};border-radius:12px;padding:36px 32px;font-family:${BRAND.fontBody};color:${BRAND.body};">
              ${opts.body}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 8px 0;font-family:${BRAND.fontBody};">
              <p style="margin:0 0 10px;font-size:13px;line-height:20px;">${footerLinks}</p>
              ${internal ? '' : `<p style="margin:0 0 10px;font-family:${BRAND.fontHeading};font-style:italic;font-size:14px;line-height:20px;color:${BRAND.body};">${c.tagline}</p>`}
              ${opts.footerNote ? `<p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${BRAND.muted};">${escapeHtml(opts.footerNote)}</p>` : ''}
              <p style="margin:0;font-size:12px;line-height:18px;color:${BRAND.muted};">&copy; ${year} Nest &amp; Quill. ${c.rights}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Body building blocks ─────────────────────────────────────────────────────
// Text arguments are HTML: escape user-supplied values with escapeHtml() first.

export function eyebrow(text: string, tone: 'accent' | 'success' | 'danger' | 'muted' = 'accent'): string {
  const color = tone === 'success' ? BRAND.success : tone === 'danger' ? BRAND.danger : tone === 'muted' ? BRAND.muted : BRAND.accentDeep
  return `<p style="margin:0 0 10px;font-family:${BRAND.fontBody};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${color};">${text}</p>`
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${BRAND.fontHeading};font-size:28px;line-height:34px;font-weight:700;color:${BRAND.text};">${text}</h1>`
}

export function subheading(text: string): string {
  return `<h2 style="margin:24px 0 8px;font-family:${BRAND.fontHeading};font-size:20px;line-height:26px;font-weight:700;color:${BRAND.text};">${text}</h2>`
}

export function paragraph(text: string, opts: { muted?: boolean; small?: boolean; italic?: boolean } = {}): string {
  const size = opts.small ? '14px' : '16px'
  const lh = opts.small ? '22px' : '26px'
  const color = opts.muted ? BRAND.muted : BRAND.body
  return `<p style="margin:0 0 16px;font-family:${BRAND.fontBody};font-size:${size};line-height:${lh};color:${color};${opts.italic ? 'font-style:italic;' : ''}">${text}</p>`
}

export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td bgcolor="${BRAND.accent}" style="background:${BRAND.accent};border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${BRAND.fontBody};font-size:15px;line-height:20px;font-weight:600;color:${BRAND.text};text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`
}

export function bulletList(items: string[]): string {
  const rows = items.map(item => `<tr>
    <td width="18" style="padding:9px 0 0;vertical-align:top;"><div style="width:8px;height:8px;background:${BRAND.accent};font-size:0;line-height:0;">&nbsp;</div></td>
    <td style="padding:0 0 8px;font-family:${BRAND.fontBody};font-size:15px;line-height:24px;color:${BRAND.body};">${item}</td>
  </tr>`).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">${rows}</table>`
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`
}

/** "Button not working? Copy this link" line. `label` is HTML, `url` is shown escaped. */
export function linkFallback(label: string, url: string): string {
  return `<p style="margin:0;font-family:${BRAND.fontBody};font-size:13px;line-height:20px;color:${BRAND.muted};">${label}<br /><a href="${url}" style="color:${BRAND.accentDeep};word-break:break-all;">${escapeHtml(url)}</a></p>`
}

export function callout(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;">
  <tr><td bgcolor="${BRAND.accentSoft}" style="background:${BRAND.accentSoft};border-left:3px solid ${BRAND.accent};border-radius:4px;padding:14px 18px;font-family:${BRAND.fontBody};font-size:15px;line-height:24px;color:${BRAND.text};">${html}</td></tr>
</table>`
}

export function quote(text: string, cite: string): string {
  return callout(`<span style="font-family:${BRAND.fontHeading};font-style:italic;font-size:16px;">&ldquo;${text}&rdquo;</span><br /><span style="font-size:12px;color:${BRAND.muted};">&mdash; ${cite}</span>`)
}

/** Label/value rows for receipts and internal notifications. Values are HTML. */
export function detailsTable(rows: Array<[label: string, value: string]>): string {
  const body = rows.map(([label, value], i) => `<tr>
    <td style="padding:10px 12px 10px 0;${i ? `border-top:1px solid ${BRAND.border};` : ''}font-family:${BRAND.fontBody};font-size:12px;line-height:18px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${BRAND.muted};vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:10px 0;${i ? `border-top:1px solid ${BRAND.border};` : ''}font-family:${BRAND.fontBody};font-size:14px;line-height:20px;color:${BRAND.text};vertical-align:top;word-break:break-word;">${value}</td>
  </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${body}</table>`
}

/** Header row + data rows (e.g. the plans table). Cells are HTML. */
export function dataTable(head: string[], rows: string[][]): string {
  const th = head.map(h => `<td bgcolor="${BRAND.text}" style="background:${BRAND.text};padding:10px 12px;font-family:${BRAND.fontBody};font-size:12px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:#ffffff;">${h}</td>`).join('')
  const tr = rows.map(r => `<tr>${r.map(cell => `<td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};font-family:${BRAND.fontBody};font-size:14px;line-height:20px;color:${BRAND.text};">${cell}</td>`).join('')}</tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:collapse;"><tr>${th}</tr>${tr}</table>`
}

/** Preformatted user text (support messages): escaped, line breaks kept. */
export function messageBlock(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td bgcolor="${BRAND.bg}" style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:16px 18px;font-family:${BRAND.fontBody};font-size:15px;line-height:24px;color:${BRAND.text};white-space:pre-wrap;">${escapeHtml(text)}</td></tr>
</table>`
}

// ── Story-failed email ───────────────────────────────────────────────────────
// Lives here (not in lib/services/email.ts) because the Edge Function sends it.

export function storyFailedEmail(opts: { lang?: EmailLang; appUrl: string; childName: string; requestId: string }): { subject: string; html: string } {
  const lang: EmailLang = opts.lang === 'es' ? 'es' : 'en'
  const site = trimSlash(opts.appUrl)
  const retryUrl = `${site}/story/${opts.requestId}`
  const raw = opts.childName
  const name = escapeHtml(raw)
  const copy = lang === 'es'
    ? {
        subject: `Tuvimos un problema con el cuento de ${raw}`,
        preheader: 'Puedes intentarlo de nuevo sin costo.',
        title: `Algo salió mal con el cuento de ${name}`,
        body1: `Tuvimos un problema al generar el libro de ${name}. Lamentamos la interrupción.`,
        body2: 'Puedes intentarlo de nuevo desde la página del cuento; solo toma un momento y no tiene costo.',
        cta: 'Intentar de nuevo →',
        help: 'Si el problema continúa, responde a este correo y lo resolveremos.',
        footer: 'Recibes este correo porque creaste un cuento en Nest & Quill.',
      }
    : {
        subject: `We hit a snag with ${raw}'s story`,
        preheader: "You can try again at no charge.",
        title: `Something went wrong with ${name}'s story`,
        body1: `We ran into a problem while generating ${name}'s storybook. We're sorry about the interruption.`,
        body2: "You can try again from the story page. It only takes a moment and there's no charge.",
        cta: 'Try again →',
        help: "If the problem keeps happening, reply to this email and we'll sort it out.",
        footer: "You're receiving this because you created a story at Nest & Quill.",
      }
  const html = renderEmail({
    lang,
    appUrl: site,
    title: copy.subject,
    preheader: copy.preheader,
    footerNote: copy.footer,
    body: [
      heading(copy.title),
      paragraph(copy.body1),
      paragraph(copy.body2),
      button(copy.cta, retryUrl),
      paragraph(copy.help, { small: true, muted: true }),
    ].join('\n'),
  })
  return { subject: copy.subject, html }
}
