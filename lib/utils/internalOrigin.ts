// Origin for server-to-server calls that carry a bearer token.
//
// appUrl() is the PUBLIC canonical URL (links, emails, metadata, auth
// redirects) and may legitimately be the apex host, which Vercel redirects
// to www. A fetch that follows that cross-host redirect drops its
// Authorization header, so an internal authenticated request built from
// appUrl() arrives unauthenticated (observed: generate-pdf → 401).
//
// Internal calls therefore target the origin that served the CURRENT
// request — the same deployment and host, no redirect — read from the
// proxy headers Vercel sets, falling back to the request URL itself. This
// also keeps preview and local development pointing at themselves.

export interface OriginSource {
  url: string
  headers: { get(name: string): string | null }
}

export function internalOrigin(req: OriginSource): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedHost) {
    const proto = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'https'
    return `${proto}://${forwardedHost}`
  }
  return new URL(req.url).origin
}

/** Absolute URL for an internal route on the current deployment. */
export function internalUrl(req: OriginSource, path: string): string {
  return `${internalOrigin(req)}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * fetch() options for internal authenticated calls: never follow a
 * redirect (which would silently strip the bearer); fail loudly instead.
 */
export const INTERNAL_FETCH_REDIRECT: RequestRedirect = 'error'
