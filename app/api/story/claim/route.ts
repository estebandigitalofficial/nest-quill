import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ claimed: 0 })

    const cookieStore = await cookies()
    const guestToken = cookieStore.get('guest_token')?.value
    if (!guestToken) return NextResponse.json({ claimed: 0 })

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('story_requests')
      .update({ user_id: user.id })
      .eq('guest_token', guestToken)
      .is('user_id', null)
      .select('id')

    if (error) {
      console.error('[story/claim] update error:', error)
      return NextResponse.json({ claimed: 0 })
    }

    const claimed = data?.length ?? 0

    const response = NextResponse.json({ claimed })
    // Clear the guest_token cookie — stories are now owned
    if (claimed > 0) {
      response.cookies.set('guest_token', '', { maxAge: 0, path: '/' })
    }
    return response
  } catch (err) {
    console.error('[story/claim] error:', err)
    return NextResponse.json({ claimed: 0 })
  }
}
