'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { appUrl } from '@/lib/utils/appUrl'
import { useLanguage } from '@/lib/i18n/context'
import { authErrorMessage } from '@/lib/i18n/authErrors'

type Role = 'parent' | 'educator' | 'student'
const ALL_ROLES: Role[] = ['parent', 'educator', 'student']

export default function SignupForm({ allowedRoles }: { allowedRoles: Role[] }) {
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const a = t.auth
  // Launch scope (Phase 2A): educator/student roles belong to the deferred
  // Classroom product; a ?role= for a hidden role falls back to parent.
  const requested = searchParams.get('role') as Role | null
  const initialRole: Role = requested && allowedRoles.includes(requested) ? requested : 'parent'
  const roles = ALL_ROLES.filter(r => allowedRoles.includes(r))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(initialRole)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (password.length < 8) {
      setError(a.signup.passwordShort)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: appUrl(`/auth/callback?next=${
          role === 'educator' ? '/classroom/educator' :
          role === 'student'  ? '/classroom/student'  : '/account'
        }`),
        data: { account_type: role },
      },
    })

    if (error) {
      setError(authErrorMessage(t, error.message))
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-8 py-8 sm:py-10 text-center space-y-4">
          <h2 className="font-serif text-xl text-oxford">{a.signup.checkTitle}</h2>
          <p className="text-sm text-charcoal-light">
            {a.signup.checkBody1}{' '}
            <span className="font-medium text-oxford break-all">{email}</span>.{' '}
            {a.signup.checkBody2}
          </p>
          <p className="text-xs text-gray-400">
            {a.signup.confirmed}{' '}
            <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">{a.signup.signIn}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-8 py-8 sm:py-10 space-y-6">
        <div>
          <h1 className="font-serif text-2xl text-oxford">{a.signup.title}</h1>
          <p className="text-sm text-charcoal-light mt-1">{a.signup.sub}</p>
        </div>

        {/* Role selector — only when more than one role is offered */}
        {roles.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-charcoal">{a.signup.iAm}</p>
          <div className="grid grid-cols-3 gap-2">
            {roles.map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-all ${role === r ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <span className={`text-[11px] font-semibold leading-tight ${role === r ? 'text-brand-700' : 'text-gray-600'}`}>{a.signup.roles[r] ?? r}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal" htmlFor="signup-email">{a.email}</label>
            <input id="signup-email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass} placeholder={a.emailPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal" htmlFor="signup-password">{a.password}</label>
            <input id="signup-password" type="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass} placeholder={a.signup.passwordPlaceholder} />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? a.signup.submitting : a.signup.submit}
          </button>
        </form>

        <p className="text-center text-sm text-charcoal-light">
          {a.signup.haveAccount}{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">{a.signup.signIn}</Link>
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-parchment-dark px-3.5 py-2.5 text-sm text-charcoal bg-white placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-oxford/30'
