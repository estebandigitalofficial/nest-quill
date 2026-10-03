import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { getSetting } from '@/lib/settings/appSettings'
import { FREE_LIFETIME_BOOKS } from '@/lib/entitlements/policy'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ claimed: 0 })

    const cookieStore = await cookies()
    const guestToken = cookieStore.get('guest_token')?.value
    if (!guestToken) return NextResponse.json({ claimed: 0 })

    const adminSupabase = createAdminClient()
    // Transfers ownership and counts the guest's Free book toward the
    // account's lifetime allowance in one atomic statement (migration 20240068).
    const freeLimit = Number(await getSetting('free_user_story_limit', FREE_LIFETIME_BOOKS)) || FREE_LIFETIME_BOOKS
    const { data, error } = await adminSupabase.rpc('claim_guest_stories', {
      p_user_id: user.id, p_guest_token: guestToken, p_limit: freeLimit,
    })

    if (error) {
      console.error('[story/claim] claim_guest_stories error:', error)
      return NextResponse.json({ claimed: 0 })
    }

    const claimed = Number(data ?? 0)

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
