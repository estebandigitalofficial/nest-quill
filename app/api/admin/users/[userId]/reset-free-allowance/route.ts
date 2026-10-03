import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { AuthError, NotFoundError, toApiError } from '@/lib/utils/errors'

// POST /api/admin/users/[id]/reset-free-allowance
//
// COMMERCIAL ENTITLEMENT. Sets profiles.free_books_used back to 0, giving
// the account its two lifetime Free books again. A deliberate goodwill
// action; it does not touch purchases, subscription periods or the legacy
// books_generated counter. Logged to processing_logs-free admin trail via
// the response only (no story is involved).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { userId } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('profiles')
      .update({ free_books_used: 0 })
      .eq('id', userId)

    if (error) throw new NotFoundError('User')

    return NextResponse.json({ ok: true, reset: ['free_books_used'], by: adminCtx.userId })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
