import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/services/email'
import { sendAdminNotification, buildNewUserEmail } from '@/lib/services/adminNotifications'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getSetting } from '@/lib/settings/appSettings'
import { isSettingEnabled } from '@/lib/settings/gates'
import { FREE_GUEST_BOOKS, FREE_LIFETIME_BOOKS } from '@/lib/entitlements/policy'

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

    const adminSupabase = createAdminClient()

    // Guest → account reconciliation (Entitlement Foundation).
    // Cookie path: the guest_token is a capability only this browser holds;
    // the SQL function transfers ownership AND counts the guest's Free book
    // toward the account's lifetime allowance in one statement.
    // Verified-email path: only when the cookie is absent and Supabase has
    // confirmed the address — never on a merely typed email.
    const freeLimit = Number(await getSetting('free_user_story_limit', FREE_LIFETIME_BOOKS)) || FREE_LIFETIME_BOOKS
    let claimed = 0
    if (guestToken) {
      const { data, error } = await adminSupabase.rpc('claim_guest_stories', { p_user_id: user.id, p_guest_token: guestToken, p_limit: freeLimit })
      if (error) console.error('[auth/callback] claim_guest_stories', error)
      claimed = Number(data ?? 0)
    }
    if (claimed === 0 && user.email && user.email_confirmed_at) {
      const reconcile = await isSettingEnabled('free_email_reconciliation_enabled', true)
      if (reconcile) {
        const { error } = await adminSupabase.rpc('claim_guest_stories_by_verified_email', {
          p_user_id: user.id, p_email: user.email, p_cap: FREE_GUEST_BOOKS, p_limit: freeLimit,
        })
        if (error) console.error('[auth/callback] claim_guest_stories_by_verified_email', error)
      }
    }

    // Send welcome email to new users (created within last 24 hours)
    if (user.email && user.created_at) {
      const ageMs = Date.now() - new Date(user.created_at).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        sendWelcomeEmail(user.email, cookieStore.get('nq_lang')?.value === 'es' ? 'es' : 'en').catch(() => {})

        const accountType = (user.user_metadata?.account_type as string | undefined) ?? 'parent'
        const { subject, html } = buildNewUserEmail({ email: user.email, accountType })
        sendAdminNotification('new_user_signed_up', subject, html).catch(() => {})
      }
    }

    // Admin check — query profile and fall back to ADMIN_EMAILS env var
    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
      .split(',').map(e => e.trim()).filter(Boolean)
    const isAdmin = adminProfile?.is_admin === true || adminEmails.includes(user.email ?? '')

    // Recovery links always land on /reset-password regardless of admin or next param
    let dest: string
    if (type === 'recovery') {
      dest = '/reset-password'
    } else if (isAdmin) {
      dest = '/admin'
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
