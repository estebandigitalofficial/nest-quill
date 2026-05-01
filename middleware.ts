import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Paths that remain accessible regardless of maintenance mode.
// /api is included so API routes (auth refresh, admin actions) keep working.
const MAINTENANCE_BYPASS = [
  '/admin',
  '/api',
  '/maintenance',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
]

async function isMaintenanceModeOn(): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return false
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?key=eq.maintenance_mode_enabled&select=value`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        next: { revalidate: 30 },
      }
    )
    if (!res.ok) return false
    const [row] = (await res.json()) as Array<{ value: unknown }>
    return row?.value === true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const bypassed = MAINTENANCE_BYPASS.some(prefix => pathname.startsWith(prefix))

  if (!bypassed) {
    const inMaintenance = await isMaintenanceModeOn()
    if (inMaintenance) {
      return NextResponse.rewrite(new URL('/maintenance', request.url))
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (Next.js image optimizer)
     * - favicon.ico, sitemap.xml
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
