import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadThumbs } from '@/components/account/loadThumbs'
import { PAGE_SIZE } from '@/components/account/pageSize'

// GET /api/account/stories?archived=true|false&cursor=<iso ts>
//
// Returns the next page of the requesting user's stories. The cursor is a
// timestamp from the last row of the previous page:
//   - active list:   created_at
//   - archived list: archived_at
// Server enforces ownership (user_id === auth.uid()) — no guest stories,
// no other users' stories. Service-role key never reaches the client.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const archived = url.searchParams.get('archived') === 'true'
  const cursor = url.searchParams.get('cursor')

  const admin = createAdminClient()

  let query = admin
    .from('story_requests')
    .select('id, child_name, story_theme, status, created_at, archived_at')
    .eq('user_id', user.id)
    .limit(PAGE_SIZE)

  if (archived) {
    query = query
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    if (cursor) query = query.lt('archived_at', cursor)
  } else {
    query = query
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    if (cursor) query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    console.error('[account/stories]', error)
    return NextResponse.json({ message: 'Could not load stories.' }, { status: 500 })
  }

  const rows = data ?? []
  const completeIds = rows.filter(r => r.status === 'complete').map(r => r.id as string)
  const thumbMap = await loadThumbs(completeIds)

  // Cursor for the next page is the timestamp of the last row we returned;
  // null when we got fewer than PAGE_SIZE (no more rows to fetch).
  const last = rows[rows.length - 1]
  const nextCursor =
    rows.length < PAGE_SIZE || !last
      ? null
      : (archived ? (last.archived_at as string) : (last.created_at as string))

  return NextResponse.json({
    rows: rows.map(r => ({
      story: r,
      thumbUrl: thumbMap[r.id as string] ?? null,
    })),
    nextCursor,
  })
}
