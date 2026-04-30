import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const db = createAdminClient()

  const [
    { data: profile },
    { data: stories },
    { data: deliveryLogs },
    { data: dripLogs },
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('story_requests')
      .select('id, child_name, story_theme, status, created_at, genre, illustration_style')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('delivery_logs')
      .select('id, email_type, status, created_at, request_id')
      .eq('recipient_email', (await db.from('profiles').select('email').eq('id', userId).single()).data?.email ?? '')
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('drip_email_log')
      .select('id, sequence, step, created_at')
      .eq('recipient_email', (await db.from('profiles').select('email').eq('id', userId).single()).data?.email ?? '')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({
    profile,
    stories: stories ?? [],
    deliveryLogs: deliveryLogs ?? [],
    dripLogs: dripLogs ?? [],
  })
}
