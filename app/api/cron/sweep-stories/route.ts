import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Scheduler entry point for story-processing continuation.
//
// Asks the process-story Edge Function to run its sweep: re-dispatch any
// request whose worker released it (time budget) or died (lease expired),
// and fail rows that have made no progress for the stale window. The sweep
// is idempotent and race-safe — the worker's atomic claim is still the only
// thing that grants ownership — so calling this more often than needed is
// harmless.
//
// Who calls it:
//   - Vercel Cron (GET, Authorization: Bearer <CRON_SECRET>) on plans that
//     allow sub-daily schedules; add an entry to vercel.json.
//   - Any external scheduler (POST or GET with the EDGE_FUNCTION_SECRET).
//   - The pg_cron job in 20240062_process_story_sweep_cron.sql calls the
//     Edge Function directly and does not need this route at all.
//
// Nothing in the customer's browser ever reaches this route.

async function authorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const edgeSecret = process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (edgeSecret && auth === `Bearer ${edgeSecret}`) return true
  // Local development convenience only: no secrets configured at all.
  return !cronSecret && !edgeSecret
}

async function runSweep(req: NextRequest) {
  if (!(await authorized(req))) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const baseUrl = process.env.EDGE_FUNCTION_BASE_URL
  if (!baseUrl) {
    return NextResponse.json({ ok: false, message: 'EDGE_FUNCTION_BASE_URL is not configured.' }, { status: 503 })
  }

  try {
    const res = await fetch(`${baseUrl}/process-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ mode: 'sweep' }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[sweep-stories] edge function responded', res.status, body)
      return NextResponse.json({ ok: false, status: res.status, body }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...body })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sweep-stories] error:', message)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return runSweep(req)
}

export async function POST(req: NextRequest) {
  return runSweep(req)
}
