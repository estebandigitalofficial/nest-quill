import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { AuthError, NotFoundError, ValidationError, toApiError } from '@/lib/utils/errors'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) throw new AuthError('Admin access required')

    const { userId } = await params

    if (userId === adminCtx.userId) {
      throw new ValidationError('Cannot delete your own account')
    }

    const supabase = createAdminClient()

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !userData.user) throw new NotFoundError('User')

    // writer_books.owner_id has no ON DELETE clause (RESTRICT by default) — null it out first
    const { error: booksError } = await supabase
      .from('writer_books')
      .update({ owner_id: null })
      .eq('owner_id', userId)

    if (booksError) throw new Error(`Failed to unlink writer books: ${booksError.message}`)

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
