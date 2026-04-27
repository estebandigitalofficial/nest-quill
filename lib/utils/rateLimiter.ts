import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Limits per route per IP within a sliding 1-hour window
const LIMITS: Record<string, number> = {
  quiz:           10,
  flashcards:     20,
  explain:        20,
  'study-guide':  15,
  math:           20,
  reading:        20,
  'study-helper':            10,
  'study-helper-assignment': 60,
  default:                   20,
}

export async function checkLearningRateLimit(
  request: NextRequest,
  route: string,
): Promise<NextResponse | null> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (ip === 'unknown') return null  // can't rate-limit unknown IPs, let through

  const limit = LIMITS[route] ?? LIMITS.default
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  try {
    const db = createAdminClient()

    // Prune old rows opportunistically (best-effort, not critical)
    void db.rpc('prune_learning_rate_limits')

    // Count recent hits for this IP + route
    const { count } = await db
      .from('learning_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('route', route)
      .gte('hit_at', windowStart)

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { message: 'Too many requests. Please wait a few minutes and try again.' },
        { status: 429 },
      )
    }

    // Record this hit (fire-and-forget)
    void db.from('learning_rate_limits').insert({ ip, route })

    return null  // allowed
  } catch {
    return null  // on DB error, let the request through
  }
}
