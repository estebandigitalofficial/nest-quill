'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
            <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
              Sign in
            </Link>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-charcoal-light">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-parchment-dark px-3.5 py-2.5 text-sm text-charcoal bg-white placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-oxford/30'
