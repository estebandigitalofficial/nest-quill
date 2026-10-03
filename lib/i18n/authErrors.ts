import type { Dictionary } from './dict/en.ts'

/**
 * Supabase auth returns English error strings. Map the common ones onto
 * localized, friendlier copy; anything else falls back to the generic line
 * so a customer never sees a raw provider message in the wrong language.
 */
export function authErrorMessage(t: Dictionary, raw: string | null | undefined): string {
  const m = (raw ?? '').toLowerCase()
  const e = t.auth.errors
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return e.invalidCredentials
  if (m.includes('email not confirmed')) return e.emailNotConfirmed
  if (m.includes('already registered') || m.includes('already exists')) return e.userExists
  if (m.includes('rate limit') || m.includes('too many')) return e.rateLimited
  return e.generic
}
