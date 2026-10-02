// Where an /admin visitor goes when getAdminContext() returns null.
//
// Signed-out visitors must reach the login page — never the public root —
// because the root is rewritten to /maintenance while Maintenance Mode is
// on, which would lock an administrator out of the panel that turns it
// off. /login is in the middleware's maintenance bypass list and honours
// `next`, so sign-in lands back on /admin. Signed-in non-admins keep the
// existing behaviour (public root). Pure; exercised by denied.test.ts.

export const ADMIN_LOGIN_REDIRECT = '/login?next=/admin'

export function adminDeniedRedirect(signedIn: boolean): string {
  return signedIn ? '/' : ADMIN_LOGIN_REDIRECT
}
