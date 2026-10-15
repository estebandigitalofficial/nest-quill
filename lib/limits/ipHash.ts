// One-way IP pseudonym for the block-only rate_limit_events log.
//
// Privacy Foundation 1 (2026-10-14): the raw client IP exists only
// transiently in server memory. It is hashed here before anything is
// written, and the raw value is never persisted on story_requests,
// support_tickets or any other Nest & Quill table, and never logged.
//
// Design (unchanged from the beta rate limiter, migration 20240054):
//   SHA-256 of the raw IP string, truncated to the first 8 bytes
//   (16 hex characters). Unsalted and unkeyed. That is enough to
//   correlate repeated blocks from one address in admin metrics without
//   storing the address, but it is a pseudonym, not anonymisation: the
//   IPv4 space is small enough to brute-force a hash offline. Switching
//   to a keyed hash (HMAC with a server secret) is tracked as a security
//   follow-up and is deliberately not done here, because it needs a new
//   production secret.
//
// Enforcement never reads this value: story and support limits count
// rows per user_id or per guest email. The hash is written only to
// rate_limit_events when a request is blocked.
//
// No imports: this module must stay importable from a node:test file.

export async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null
  try {
    const buf = new TextEncoder().encode(ip)
    const digest = await crypto.subtle.digest('SHA-256', buf)
    const bytes = new Uint8Array(digest)
    return Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}
