import { Suspense } from 'react'
import SignupForm from './SignupForm'
import { getLaunchFlags } from '@/lib/launch/flags'
import { signupRoles } from '@/lib/launch/scope'

// Launch scope (Phase 2A): the signup form is a client component; the server
// page decides which roles are offered from the launch flags.
// Flags live in app_settings, so this page must render per request, never at build time.
export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const flags = await getLaunchFlags()
  return (
    <Suspense>
      <SignupForm allowedRoles={signupRoles(flags)} />
    </Suspense>
  )
}
