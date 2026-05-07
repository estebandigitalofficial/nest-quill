// PATCH /api/notifications/[id]/read — marks a single notification as
// read for the signed-in user. Auth comes from the cookie-bound client;
// the mutation runs through the admin client (matches the established
// codebase pattern in restore/archive routes), with an explicit
// user_id equality check on top of RLS as the ownership gate.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthError, NotFoundError, toApiError } from '@/lib/utils/errors'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) throw new NotFoundError('Notification')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new AuthError('Sign-in required')

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)        // explicit ownership check
      .is('read_at', null)            // idempotent: already-read is a no-op
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      // Either the id doesn't exist, isn't owned by this user, or was
      // already read. All three are safe to return as ok with a hint.
      return NextResponse.json({ ok: true, already: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
