'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

type Role = 'parent' | 'educator' | 'student'

const ROLES: { value: Role; label: string; emoji: string; desc: string }[] = [
  { value: 'parent', label: 'Parent / Family', emoji: '👨‍👩‍👧', desc: 'Create stories for my child' },
  { value: 'educator', label: 'Educator', emoji: '🏫', desc: 'Assign learning tools to my class' },
  { value: 'student', label: 'Student', emoji: '🎒', desc: 'Complete assignments from my teacher' },
]

function SignupForm() {
  const searchParams = useSearchParams()
  const initialRole = (searchParams.get('role') as Role) ?? 'parent'

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
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${
          role === 'educator' ? '/classroom/educator' :
          role === 'student'  ? '/classroom/student'  : '/account'
        }`,
        data: { account_type: role },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h2 className="font-serif text-xl text-oxford">Check your email</h2>
          <p className="text-sm text-charcoal-light">
            We sent a confirmation link to{' '}
            <span className="font-medium text-oxford">{email}</span>.
            Click it to activate your account.
          </p>
          <p className="text-xs text-gray-400">
            Already confirmed?{' '}
            <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 space-y-6">
        <div>
          <h1 className="font-serif text-2xl text-oxford">Create an account</h1>
          <p className="text-sm text-charcoal-light mt-1">Free to join. No credit card required.</p>
        </div>

        {/* Role selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-charcoal">I am a…</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(r => (
              <button key={r.value} type="button" onClick={() => setRole(r.value)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-all ${role === r.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <span className="text-xl">{r.emoji}</span>
                <span className={`text-[11px] font-semibold leading-tight ${role === r.value ? 'text-brand-700' : 'text-gray-600'}`}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Email</label>
            <input type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Password</label>
            <input type="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass} placeholder="At least 8 characters" />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-charcoal-light">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}

const inputClass =
  'w-full rounded-lg border border-parchment-dark px-3.5 py-2.5 text-sm text-charcoal bg-white placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-oxford/30'
