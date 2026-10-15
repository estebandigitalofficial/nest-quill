import { Suspense } from 'react'
import LoginForm from './LoginForm'
import { getLaunchFlags } from '@/lib/launch/flags'

// Mirrors /signup: the form is a client component; the server page reads the
// launch flags so the post-login destination follows the current public scope
// (see accountHomeHref in lib/launch/scope.ts). Flags live in app_settings, so
// this page renders per request, never at build time.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const flags = await getLaunchFlags()
  return (
    <Suspense>
      <LoginForm flags={flags} />
    </Suspense>
  )
}
