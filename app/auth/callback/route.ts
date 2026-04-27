import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/services/email'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next')

  const supabase = await createClient()

  // Resolve the session from either a token_hash (custom email templates) or a
  // PKCE code (Supabase default email links). token_hash is preferred because it
  // is set directly in our email templates; code is kept as a fallback.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })
    if (!error) user = data.user
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) user = data.user
  }

  if (user) {
    const cookieStore = await cookies()
    const guestToken = cookieStore.get('guest_token')?.value

    if (guestToken) {
      const adminSupabase = createAdminClient()
      await adminSupabase
        .from('story_requests')
        .update({ user_id: user.id })
        .eq('guest_token', guestToken)
        .is('user_id', null)
    }

    // Send welcome email to new users (created within last 24 hours)
    if (user.email && user.created_at) {
      const ageMs = Date.now() - new Date(user.created_at).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        sendWelcomeEmail(user.email).catch(() => {})
      }
    }

    // Recovery links always land on /reset-password regardless of next param
    let dest: string
    if (type === 'recovery') {
      dest = '/reset-password'
    } else {
      const accountType = user.user_metadata?.account_type ?? 'parent'
      dest = nextParam ?? (
        accountType === 'educator' ? '/classroom/educator'
        : accountType === 'student'  ? '/classroom/student'
        : '/account'
      )
    }

    const redirectResponse = NextResponse.redirect(new URL(dest, origin))
    if (guestToken) {
      redirectResponse.cookies.set('guest_token', '', { maxAge: 0, path: '/' })
    }
    return redirectResponse
  }

  return NextResponse.redirect(new URL('/login?error=confirmation_failed', origin))
}
