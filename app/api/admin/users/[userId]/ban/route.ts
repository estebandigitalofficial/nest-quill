import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { AuthError, NotFoundError, ValidationError, toApiError } from '@/lib/utils/errors'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { userId } = await params

    if (userId === adminCtx.userId) {
      throw new ValidationError('Cannot ban yourself')
    }

    const body = await request.json().catch(() => ({}))
    const unban = body.unban === true

    const supabase = createAdminClient()

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !userData.user) throw new NotFoundError('User')

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: unban ? 'none' : '876600h', // ~100 years
    })

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, banned: !unban })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
