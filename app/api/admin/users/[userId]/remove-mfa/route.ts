import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { AuthError, NotFoundError, toApiError } from '@/lib/utils/errors'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { userId } = await params
    const supabase = createAdminClient()

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !userData.user) throw new NotFoundError('User')

    const factors = userData.user.factors ?? []
    if (factors.length === 0) {
      return NextResponse.json({ ok: true, removed: 0 })
    }

    const results = await Promise.all(
      factors.map(f =>
        supabase.auth.admin.mfa.deleteFactor({ userId, id: f.id })
      )
    )

    const firstErr = results.find(r => r.error)?.error
    if (firstErr) throw new Error(firstErr.message)

    return NextResponse.json({ ok: true, removed: factors.length })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
