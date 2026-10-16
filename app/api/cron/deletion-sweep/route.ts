import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedSweepRequest, reconcileStartedDeletions, type ReconciliationClient } from '@/lib/deletion/reconcileStartedDeletions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Failed-story deletion reconciliation (Privacy Foundation 3C-6).
//
// Scheduler entry point only. Vercel Cron (vercel.json) calls it with
// `Authorization: Bearer <CRON_SECRET>`; the check fails closed when the
// secret is not configured, so nothing can trigger a sweep by accident in
// any environment. GET only, because Vercel Cron issues GET and nothing
// else is meant to call this. No customer, admin page or browser code
// reaches this route.
//
// The route itself decides nothing: lib/deletion/reconcileStartedDeletions
// selects the bounded batch of started customer story deletions at least
// ten minutes old and hands each one to the 3C-2 service, which owns every
// storage rule. The response is the aggregate summary (counts, failure-code
// histogram, duration): no ids, no paths, no content.
export async function GET(req: NextRequest) {
  if (!isAuthorizedSweepRequest(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // createAdminClient() is deliberately untyped (createClient<any>); the structural
  // cast names the exact surface the sweep and the 3C-2 service use (rpc, storage, from/select).
  const summary = await reconcileStartedDeletions(createAdminClient() as unknown as ReconciliationClient)
  console.info('[deletion-sweep]', JSON.stringify(summary))
  const ok = summary.selectionError === null
  return NextResponse.json({ ok, ...summary }, { status: ok ? 200 : 500 })
}
