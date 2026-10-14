// Marketing / product-engagement email: the single sending path that honors
// the suppression list and stamps every message with an unsubscribe link.
//
// Scope. Only engagement mail goes through here: the signup drip, the story
// drip, template-driven drips, and any future promotional or re-engagement
// sequence. Transactional mail (story ready / failed, submission receipt,
// auth, password reset, support replies) never calls this module and is never
// suppressed by it; see lib/services/email.ts for which sender is which.
//
// Guarantees, in order, for every call to deliverMarketingEmail():
//   1. the address is normalized (lower-cased, trimmed) or the send is refused;
//   2. the suppression list is consulted server-side BEFORE any provider call;
//   3. a suppressed address returns { sent: false, reason: 'suppressed' } and
//      the provider is never invoked;
//   4. an eligible address gets a signed unsubscribe link in the footer and
//      RFC 8058 List-Unsubscribe headers;
//   5. a missing signing secret throws: marketing mail cannot go out without a
//      working unsubscribe link (fail closed).
//
// Pure module: the store and the provider are injected so this is unit-tested
// without Supabase or Resend. lib/services/email.ts wires the real ones.

import { renderEmail, type EmailLang } from './layout.ts'
import {
  getUnsubscribeSecret, normalizeEmail, signUnsubscribeToken, verifyUnsubscribeToken,
  unsubscribePageUrl, unsubscribeOneClickUrl,
} from './unsubscribe.ts'

export const SUPPRESSION_TABLE = 'marketing_email_suppressions'

export type SuppressionSource = 'unsubscribe_link' | 'one_click' | 'admin'

/** Durable suppression record. Presence = suppressed; nothing else is inferred. */
export interface SuppressionStore {
  /** `email` is already normalized. Throws on lookup failure (the caller must not send). */
  isSuppressed(email: string): Promise<boolean>
  /** Idempotent: a second call for the same address is a no-op that keeps the first timestamp. */
  suppress(email: string, source: SuppressionSource): Promise<void>
}

/**
 * Minimal slice of the supabase-js client this module touches. The admin
 * client is intentionally untyped (createClient<any>), so this stays loose on
 * purpose; the two query shapes used are spelled out in the store below.
 */
interface SuppressionTableClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
}

/** Service-role store over public.marketing_email_suppressions. */
export function createSupabaseSuppressionStore(client: SuppressionTableClient): SuppressionStore {
  return {
    async isSuppressed(email) {
      const { data, error } = (await client.from(SUPPRESSION_TABLE).select('email').eq('email', email).maybeSingle()) as
        { data: unknown; error: { message: string } | null }
      if (error) throw new Error(`suppression lookup failed: ${error.message}`)
      return data != null
    },
    async suppress(email, source) {
      const { error } = (await client
        .from(SUPPRESSION_TABLE)
        .upsert({ email, source }, { onConflict: 'email', ignoreDuplicates: true })) as { error: { message: string } | null }
      if (error) throw new Error(`suppression insert failed: ${error.message}`)
    },
  }
}

export function memorySuppressionStore(initial: string[] = []): SuppressionStore & { rows: Map<string, SuppressionSource> } {
  const rows = new Map<string, SuppressionSource>(initial.map(e => [e, 'admin' as const]))
  return {
    rows,
    async isSuppressed(email) { return rows.has(email) },
    async suppress(email, source) { if (!rows.has(email)) rows.set(email, source) },
  }
}

// ── Footer copy ──────────────────────────────────────────────────────────────
// Why the reader got a marketing email. Deliberately does not claim that
// unsubscribing stops service messages (story ready, receipts, account mail).

export const MARKETING_FOOTER: Record<EmailLang, string> = {
  en: "You're receiving this email because you used Nest & Quill. You can unsubscribe from product and promotional emails at any time.",
  es: 'Recibes este correo porque usaste Nest & Quill. Puedes cancelar la suscripción a los correos de producto y promociones cuando quieras.',
}

// ── Delivery ─────────────────────────────────────────────────────────────────

export interface MarketingMessage {
  toEmail: string
  subject: string
  /** Inner HTML built from lib/email/layout helpers. */
  body: string
  preheader?: string
  lang?: EmailLang
}

export interface ProviderMessage {
  to: string
  subject: string
  html: string
  headers: Record<string, string>
}

export interface MarketingDeps {
  store: SuppressionStore
  appUrl: string
  /** Provider call (Resend in production). Only invoked for eligible recipients. */
  send(message: ProviderMessage): Promise<void>
  /** Signing secret; defaults to the environment (throws when unset). */
  secret?: string
}

export type MarketingSendResult =
  | { sent: true; to: string }
  | { sent: false; reason: 'suppressed' | 'invalid_email' | 'unknown_step'; to: string | null }

/**
 * Sends one marketing email, or refuses to. Never advances or records anything
 * itself: callers (the drip cron) log a delivery only when `sent` is true.
 */
export async function deliverMarketingEmail(message: MarketingMessage, deps: MarketingDeps): Promise<MarketingSendResult> {
  const secret = deps.secret ?? getUnsubscribeSecret()
  const to = normalizeEmail(message.toEmail)
  if (!to) return { sent: false, reason: 'invalid_email', to: null }

  if (await deps.store.isSuppressed(to)) return { sent: false, reason: 'suppressed', to }

  const lang: EmailLang = message.lang === 'es' ? 'es' : 'en'
  const token = signUnsubscribeToken({ email: to, lang }, secret)
  const html = renderEmail({
    lang,
    appUrl: deps.appUrl,
    title: message.subject,
    preheader: message.preheader,
    footerNote: MARKETING_FOOTER[lang],
    unsubscribeUrl: unsubscribePageUrl(deps.appUrl, token),
    body: message.body,
  })

  await deps.send({
    to,
    subject: message.subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeOneClickUrl(deps.appUrl, token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  return { sent: true, to }
}

// ── Unsubscribe ──────────────────────────────────────────────────────────────

export type UnsubscribeResult =
  | { ok: true; lang: EmailLang; alreadySuppressed: boolean }
  | { ok: false }

/**
 * Verifies a public unsubscribe token and records the suppression.
 * Idempotent; an invalid token changes nothing and reveals nothing about
 * whether any address exists. The email is never returned to the caller.
 */
export async function unsubscribeWithToken(
  token: unknown,
  deps: { store: SuppressionStore; source: SuppressionSource; secret?: string },
): Promise<UnsubscribeResult> {
  let secret: string
  try {
    secret = deps.secret ?? getUnsubscribeSecret()
  } catch {
    return { ok: false }
  }
  const claims = verifyUnsubscribeToken(token, secret)
  if (!claims) return { ok: false }
  const alreadySuppressed = await deps.store.isSuppressed(claims.email)
  if (!alreadySuppressed) await deps.store.suppress(claims.email, deps.source)
  return { ok: true, lang: claims.lang, alreadySuppressed }
}
