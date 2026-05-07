// GET /api/notifications — returns the most recent 25 notifications for
// the signed-in user, plus the unread count. RLS does the ownership
// gate; this route uses the cookie-bound supabase client (anon key) so
// there's no service-role exposure.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuthError, toApiError } from '@/lib/utils/errors'
import type { Notification } from '@/lib/notifications/types'

const PAGE_LIMIT = 25

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new AuthError('Sign-in required')

    // RLS restricts to the user's own rows; eq is belt-and-suspenders.
    const [{ data: rows, error: listErr }, { count: unreadCount, error: countErr }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, body, href, read_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_LIMIT),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
    ])
    if (listErr) throw listErr
    if (countErr) throw countErr

    type Row = { id: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }
    const notifications: Notification[] = (rows ?? []).map((r: Row) => ({
      id: r.id,
      title: r.title,
      body: r.body ?? undefined,
      href: r.href ?? undefined,
      createdAt: r.created_at,
      unread: r.read_at === null,
    }))

    return NextResponse.json({ notifications, unreadCount: unreadCount ?? 0 })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
