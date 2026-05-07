// GET /api/contact/health — admin-only diagnostic for the support
// intake pipeline. Verifies, without writing anything sensitive:
//   - support_tickets_enabled is parseable
//   - support_tickets table is reachable + has the columns we insert
//   - rate_limit_events table is reachable (or absent — graceful)
//   - notifications table is reachable
//   - the admin Supabase client can reach the project
//
// Locked behind getAdminContext so this never leaks production
// internals to anonymous callers.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { getSetting } from '@/lib/settings/appSettings'
import { isSettingEnabled } from '@/lib/settings/gates'

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const checks: Record<string, unknown> = {}

  // 1. Setting present + parseable.
  try {
    const raw = await getSetting<unknown>('support_tickets_enabled', undefined)
    const enabled = await isSettingEnabled('support_tickets_enabled')
    checks.support_tickets_enabled = { raw, type: typeof raw, parsed: enabled }
  } catch (err) {
    checks.support_tickets_enabled = { error: err instanceof Error ? err.message : String(err) }
  }

  // 2. support_tickets reachable + insert-ready (head:true count probes
  //    relation existence; the columns we care about are exercised by
  //    a select so a missing column would surface as 42703).
  try {
    const { count, error } = await db
      .from('support_tickets')
      .select('id, email, name, subject, message, category, source, status, priority, user_id, created_at', {
        count: 'exact',
        head: true,
      })
    checks.support_tickets = error
      ? { ok: false, code: error.code, message: error.message, hint: error.hint, details: error.details }
      : { ok: true, rowCount: count }
  } catch (err) {
    checks.support_tickets = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // 3. rate_limit_events reachable (graceful — table may be missing
  //    on first-run environments).
  try {
    const { count, error } = await db
      .from('rate_limit_events')
      .select('id', { count: 'exact', head: true })
    checks.rate_limit_events = error
      ? { ok: false, code: error.code, message: error.message }
      : { ok: true, rowCount: count }
  } catch (err) {
    checks.rate_limit_events = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // 4. notifications reachable.
  try {
    const { count, error } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
    checks.notifications = error
      ? { ok: false, code: error.code, message: error.message }
      : { ok: true, rowCount: count }
  } catch (err) {
    checks.notifications = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // 5. Env presence (does NOT echo the values).
  checks.env = {
    SUPABASE_URL_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
  }

  return NextResponse.json({ ok: true, checks })
}
