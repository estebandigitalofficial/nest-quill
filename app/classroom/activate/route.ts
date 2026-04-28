import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /classroom/activate?role=educator|student
// Sets account_type in user_metadata (refreshes session cookie) then redirects
// to the appropriate classroom dashboard. Used by logged-in users without a
// classroom role so they can activate one without going through /signup again.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const role = searchParams.get('role')

  if (role !== 'educator' && role !== 'student') {
    return NextResponse.redirect(new URL('/classroom', origin))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=/classroom/${role}`, origin)
    )
  }

  // updateUser on the server client writes the refreshed JWT to cookies, so
  // the very next server request (the redirect target) sees the new account_type.
  await supabase.auth.updateUser({ data: { account_type: role } })

  return NextResponse.redirect(
    new URL(role === 'educator' ? '/classroom/educator' : '/classroom/student', origin)
  )
}
