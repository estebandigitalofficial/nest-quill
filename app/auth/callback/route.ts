import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/services/email'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const cookieStore = await cookies()
      const guestToken = cookieStore.get('guest_token')?.value

      if (guestToken) {
        const adminSupabase = createAdminClient()
        await adminSupabase
          .from('story_requests')
          .update({ user_id: data.user.id })
          .eq('guest_token', guestToken)
          .is('user_id', null)
      }

      // Send welcome email to new users (created within last 24 hours)
      if (data.user.email && data.user.created_at) {
        const ageMs = Date.now() - new Date(data.user.created_at).getTime()
        if (ageMs < 24 * 60 * 60 * 1000) {
          sendWelcomeEmail(data.user.email).catch(() => {})
        }
      }

      let dest = nextParam
      if (!dest) {
        const accountType = data.user.user_metadata?.account_type ?? 'parent'
        dest = accountType === 'educator' ? '/classroom/educator'
             : accountType === 'student'  ? '/classroom/student'
             : '/account'
      }

      const redirectResponse = NextResponse.redirect(new URL(dest, origin))
      if (guestToken) {
        redirectResponse.cookies.set('guest_token', '', { maxAge: 0, path: '/' })
      }
      return redirectResponse
    }
  }

  return NextResponse.redirect(new URL('/login?error=confirmation_failed', origin))
}
