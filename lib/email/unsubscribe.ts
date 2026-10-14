// Unsubscribe tokens for marketing / product-engagement email.
//
// A token binds one normalized recipient address (and the language of the
// email it was issued for) to an HMAC-SHA256 signature. The public
// /unsubscribe link carries only this token: no database id, no raw email,
// nothing a caller can forge or edit without the secret. Verification is
// server-side; a tampered token verifies as invalid and suppresses nothing.
//
// Tokens do not expire: an unsubscribe link in an email must keep working for
// as long as that email sits in an inbox. Rotating UNSUBSCRIBE_TOKEN_SECRET
// invalidates every previously issued link, which is the only revocation.
//
// Pure module (node:crypto only) so it is unit-testable and safe to import
// from route handlers, server components and lib/services.

import { createHmac, timingSafeEqual } from 'node:crypto'

export type UnsubscribeLang = 'en' | 'es'

/** Vercel env var that signs unsubscribe tokens. Required for every marketing send. */
export const UNSUBSCRIBE_SECRET_ENV = 'UNSUBSCRIBE_TOKEN_SECRET'
const MIN_SECRET_LENGTH = 32
const VERSION = 'v1'

/**
 * Canonical form of a recipient address for suppression purposes.
 * Trim + lower-case the whole address. Returns null when the value does not
 * look like an address at all, so callers never store junk.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (email.length < 3 || email.length > 320) return null
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@') || at === email.length - 1) return null
  if (/[\s<>,;"]/.test(email)) return null
  return email
}

/** Reads the signing secret from the environment; throws when absent or too short. */
export function getUnsubscribeSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env[UNSUBSCRIBE_SECRET_ENV]?.trim() ?? ''
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`${UNSUBSCRIBE_SECRET_ENV} must be set to at least ${MIN_SECRET_LENGTH} characters; marketing email cannot be sent without a working unsubscribe link`)
  }
  return secret
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function sign(message: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(message).digest())
}

export interface UnsubscribeClaims {
  /** Normalized recipient address. */
  email: string
  /** Language of the email the link was issued for. */
  lang: UnsubscribeLang
}

/** Builds a signed token for `claims`. `claims.email` must already be normalized. */
export function signUnsubscribeToken(claims: UnsubscribeClaims, secret: string): string {
  const email = normalizeEmail(claims.email)
  if (!email || email !== claims.email) throw new Error('unsubscribe token requires a normalized email')
  const lang: UnsubscribeLang = claims.lang === 'es' ? 'es' : 'en'
  const payload = b64url(Buffer.from(JSON.stringify({ e: email, l: lang }), 'utf8'))
  const message = `${VERSION}.${payload}`
  return `${message}.${sign(message, secret)}`
}

/**
 * Verifies a token. Returns the claims only when the signature matches and
 * the payload is well-formed; every other input (missing, truncated, edited,
 * signed with another secret) returns null. Never throws on bad input.
 */
export function verifyUnsubscribeToken(token: unknown, secret: string): UnsubscribeClaims | null {
  if (typeof token !== 'string' || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return null
  const [version, payload, sig] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null

  const expected = Buffer.from(sign(`${version}.${payload}`, secret), 'utf8')
  const given = Buffer.from(sig, 'utf8')
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const { e, l } = parsed as { e?: unknown; l?: unknown }
  const email = normalizeEmail(e)
  if (!email || email !== e) return null
  return { email, lang: l === 'es' ? 'es' : 'en' }
}

/** Public page that performs the unsubscribe and shows the result. */
export function unsubscribePageUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/unsubscribe?t=${encodeURIComponent(token)}`
}

/** RFC 8058 one-click endpoint used in the List-Unsubscribe header. */
export function unsubscribeOneClickUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/api/unsubscribe?t=${encodeURIComponent(token)}`
}
