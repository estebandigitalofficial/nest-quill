import { createClient } from '@supabase/supabase-js'

/**
 * DANGER: This client bypasses Row Level Security entirely.
 * Use ONLY in:
 * - Stripe webhook handler
 * - Supabase Edge Functions
 * - Admin-only API routes (protected by is_admin check)
 *
 * Never expose this client to the browser or to unauthenticated routes.
 *
 * NOTE: This client is intentionally untyped. Once `supabase start` is running,
 * generate accurate types with `pnpm run types` and re-add the Database generic.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
