// Canonical production URL for outbound user-facing links (emails, auth
// redirects, admin links). Reads NEXT_PUBLIC_APP_URL when set to a real
// production-style host; otherwise falls back to the prod domain.
//
// Vercel auto-injects preview deploy URLs (e.g. *-preview.vercel.app) into
// NEXT_PUBLIC_APP_URL on preview branches, which would leak into prod
// emails when the same code path runs against shared infra. The vercel.app
// filter prevents that — preview deploys still work for in-browser nav,
// but emails always use the canonical domain.
//
// Local dev: set NEXT_PUBLIC_APP_URL=http://localhost:3000 in .env.local.

const PROD_URL = 'https://nestandquill.com'

function isUsable(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  // Reject *.vercel.app preview URLs in outbound links — they're not the
  // canonical domain, can rotate per deploy, and confuse users.
  if (/\.vercel\.app(?:[\/:]|$)/i.test(url)) return false
  return true
}

export function getAppUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env && isUsable(env)) return env.replace(/\/+$/, '')
  return PROD_URL
}

/** Build an absolute URL by joining a path onto the canonical app URL. */
export function appUrl(path = ''): string {
  const base = getAppUrl()
  if (!path) return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
