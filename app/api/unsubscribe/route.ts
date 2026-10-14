import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseSuppressionStore, unsubscribeWithToken } from '@/lib/email/marketing'
import { appUrl } from '@/lib/utils/appUrl'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Target of the List-Unsubscribe header on marketing email.
//
// POST is the RFC 8058 one-click unsubscribe mail clients send when the user
// presses their "Unsubscribe" button: verify the signed token, record the
// suppression, answer 200. Idempotent. Invalid tokens answer 400 with no
// detail, so this endpoint reveals nothing about any address.
//
// GET is a mail client or person opening the header URL directly: hand them
// to the /unsubscribe page, which performs the same action and shows the
// result in their language.

function tokenFrom(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('t')
}

export async function POST(req: NextRequest) {
  const token = tokenFrom(req)
  if (!token) return new NextResponse(null, { status: 400 })
  try {
    const result = await unsubscribeWithToken(token, {
      store: createSupabaseSuppressionStore(createAdminClient()),
      source: 'one_click',
    })
    return new NextResponse(null, { status: result.ok ? 200 : 400 })
  } catch (err) {
    console.error('One-click unsubscribe failed:', err)
    return new NextResponse(null, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = tokenFrom(req) ?? ''
  return NextResponse.redirect(`${appUrl('/unsubscribe')}?t=${encodeURIComponent(token)}`, 302)
}
